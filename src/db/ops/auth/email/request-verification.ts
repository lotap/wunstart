import {DateTime, Effect} from 'effect'

import * as emailVerificationsCascades from '#/db/models/email-verifications/cascades.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {extractPgError} from '#/db/ops/_extract-pg-error.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {hashTarget} from '#/db/ops/auth/_hashing.ts'
import {extractErrorProps, opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailService} from '#/email/service.ts'
import {renderVerificationEmail} from '#/email/templates/verify-email.tsx'
import {EmailRequestVerificationCredentials} from '#/isomorphic/validations/auth.ts'

const genericFailureOutputMessage = 'Something went wrong. Please try again in a moment.'

const _emailRequestVerification = Effect.fn('emailRequestVerification')(function* ({
	input: {email, expectRegisteredRecipient},
	anonTokenPayload,
	userId,
	ipAddress,
}: {
	input: Partial<(typeof EmailRequestVerificationCredentials)['Type']>
	anonTokenPayload: AnonTokenPayloadCustomClaims | null
	userId?: string
	ipAddress: string
}) {
	const hasherId = userId ?? anonTokenPayload?.id
	if (!hasherId)
		return yield* opsFailure({
			failureCause: 'INVALID_PARAMS',
			message: 'must provide either anonTokenPayload or userId',
		})

	/** Only registered anons have a database row, so only their id may populate the FK column */
	const registeredAnonId = anonTokenPayload?.registered ? anonTokenPayload.id : undefined

	if (anonTokenPayload && !email)
		return yield* opsFailure({
			failureCause: 'INVALID_PARAMS',
			anonId: registeredAnonId,
			message: 'input: email is required when using anonTokenPayload',
		})

	/** Rate-limit check against ip address & id */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		anonId: registeredAnonId,
		failedCredential: email,
		userId,
	})
	if (currentBansAndExcessiveActivities.length)
		return yield* rateLimitFailure({
			message: genericFailureOutputMessage,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
			userId,
		})

	/** Get the user's email if it's undefined */
	let derivedEmail = email
	if (!derivedEmail && userId) {
		const [user] = yield* usersQueries.select({id: userId})
		if (!user)
			return yield* opsFailure({
				failureCause: 'USER_NOT_FOUND',
				/** meta, not the userId column: the referenced user may no longer exist, which would violate the FK */
				meta: {userId},
				rateAllowance: 6,
				message: genericFailureOutputMessage,
			})
		derivedEmail = user.email
	}

	/** email is guaranteed at this point: it's either provided, or derived from the user's notNull email */
	if (!derivedEmail)
		return yield* opsFailure({
			failureCause: 'MISSING_EMAIL',
			message: genericFailureOutputMessage,
		})

	/**
	 * Generate a uniform 6-digit verification code. Rejection sampling keeps
	 * the draw unbiased: 2^32 is not divisible by 10^6, so samples from the
	 * trailing partial cycle are redrawn instead of folded into the leading digits.
	 */
	const CODE_LIMIT = 1_000_000
	const unbiasedBound = 2 ** 32 - (2 ** 32 % CODE_LIMIT)
	const buffer = new Uint32Array(1)
	const nextDraw = () => {
		crypto.getRandomValues(buffer)
		return buffer[0]
	}
	let draw = nextDraw()
	while (draw === undefined || draw >= unbiasedBound) draw = nextDraw()
	const code = (draw % CODE_LIMIT).toString().padStart(6, '0')

	return yield* Effect.gen(function* () {
		/** Hash the passcode using Argon2id */
		const passcodeHash = yield* hashTarget(code)

		const verificationInput: Parameters<typeof emailVerificationsQueries.insert>[0] | undefined =
			registeredAnonId
				? {email: derivedEmail, anonId: registeredAnonId, userId: null, passcodeHash}
				: userId
					? {email: derivedEmail, anonId: null, userId, passcodeHash}
					: undefined

		if (!verificationInput)
			return yield* opsFailure({
				failureCause: 'INVALID_PARAMS',
				anonId: registeredAnonId,
				userId,
				message: 'must provide either anonTokenPayload or userId',
			})

		/**
		 * Render the verification email before the verification row commits: a
		 * render failure fails the operation
		 */
		const {html, text, subject} = yield* Effect.tryPromise({
			try: () => renderVerificationEmail(code),
			catch: (cause) =>
				opsFailure({
					failureCause: 'EMAIL_RENDER',
					userId,
					meta: extractErrorProps(cause),
					message: genericFailureOutputMessage,
				}),
		})

		/**
		 * Upsert the verification row.
		 * Try insert first; on unique violation (23505), update the existing unverified row.
		 */
		const [data] = yield* emailVerificationsQueries.insert(verificationInput).pipe(
			Effect.catchTag('EffectDrizzleQueryError', (drizzleError) => {
				if (extractPgError(drizzleError) === 'UniqueViolation')
					return emailVerificationsQueries.resetFromExpiringByEmail(verificationInput)

				return Effect.fail(drizzleError)
			}),
		)

		if (!data)
			return yield* opsFailure({
				anonId: registeredAnonId,
				userId,
				failedCredential: derivedEmail,
				failureCause: 'TOO_SOON_SINCE_LAST_RESET',
				rateAllowance: 6,
				message: 'A new code isn’t ready for that address yet. Give it a moment and try again.',
			})

		const {send} = yield* EmailService

		/**
		 * Delivery screening: withhold the email and return success immediately
		 * when the expectation is violated. `true` expects a registered
		 * recipient, so an unknown account receives nothing. `false` expects an
		 * unregistered recipient, so an existing account receives nothing.
		 * Omitted always delivers. The response is identical either
		 * way so delivery state cannot be probed.
		 */
		if (expectRegisteredRecipient !== undefined) {
			const recipientRows = yield* usersQueries.selectByEmail({email: derivedEmail})

			if (
				(expectRegisteredRecipient && !recipientRows.length) ||
				(!expectRegisteredRecipient && recipientRows.length)
			)
				/** @todo consider adding a delay to mimic the time it takes to send an email to prevent enumeration attacks */
				return {
					id: null,
					expiresAt: DateTime.toDate(
						DateTime.add(yield* DateTime.now, {milliseconds: 15 * 60 * 1000}),
					),
				}
		}

		/**
		 * The email is the deliverable. A send failure retires the verification
		 * intent (so a retry can mint a fresh code immediately) and fails the
		 * operation: the user must be told the code never went out instead of
		 * waiting for one that will never arrive.
		 *
		 * The retirement is guarded by the passcode hash just minted, so a
		 * concurrent reset that replaced the row is left alone. It is itself
		 * best-effort: an infrastructure failure here must not mask the
		 * EMAIL_SEND error the user needs to see. A row that survives the
		 * attempt can delay an immediate retry behind TOO_SOON_SINCE_LAST_RESET,
		 * which is acceptable relative to hiding the real failure.
		 */
		yield* send({to: derivedEmail, subject, html, text}).pipe(
			Effect.catchTag('EmailSendError', (error) =>
				Effect.gen(function* () {
					yield* emailVerificationsCascades.archiveWithPasscode({id: data.id, passcodeHash}).pipe(
						retryTransientDb,
						Effect.catchTags({
							ArchiveNotFoundError: () => Effect.void,
							ArchiveCountMismatchError: () => Effect.void,
						}),
						Effect.ignore({
							log: true,
							message: 'Failed to retire the verification intent after a send failure',
						}),
					)

					return yield* opsFailure({
						failureCause: 'EMAIL_SEND',
						anonId: registeredAnonId,
						userId,
						failedCredential: derivedEmail,
						meta: {transport: error.transport, code: error.code, kind: error.kind},
						message: 'We couldn’t send your code. Give it another go.',
					})
				}),
			),
		)

		return data
	}).pipe(Effect.provide(HashingStub.layer(hasherId)))
})

export const emailRequestVerification = createOpsFn({
	fn: _emailRequestVerification,
	label: 'AUTH_EMAIL_REQUEST_VERIFICATION',
})

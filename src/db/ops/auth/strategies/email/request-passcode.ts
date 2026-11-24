import {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {Effect, Schema} from 'effect'
import type {SchemaError} from 'effect/Schema'

import * as anonsQueries from '#/db/models/anons/queries.ts'
import * as emailVerificationsCascades from '#/db/models/email-verifications/cascades.ts'
import {PASSCODE_EXPIRATION} from '#/db/models/email-verifications/consts.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {extractPgCode, extractPgError} from '#/db/ops/_extract-pg-error.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {hashTarget} from '#/db/ops/auth/_hashing.ts'
import {ANON_SESSION_EXPIRED_MESSAGE} from '#/db/ops/auth/messages.ts'
import {verifyLiveSession} from '#/db/ops/auth/sessions/_verify-live-session.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/tokens/_anon-token.ts'
import {
	extractErrorProps,
	allowRatePerWindow,
	createOpsFailure,
	OpsErrorSchema,
	opsFailure,
} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailService} from '#/email/service.ts'
import {renderNoAccountFound} from '#/email/templates/no-account-found.tsx'
import {renderVerificationEmail} from '#/email/templates/verify-email.tsx'
import type {PasscodeIntent} from '#/isomorphic/validations/auth.ts'

import {
	EMAIL_REQUEST_GENERIC_FAILURE_MESSAGE,
	PASSCODE_SEND_FAILED_MESSAGE,
	PASSCODE_TOO_SOON_MESSAGE,
} from './_messages.ts'
import {PASSCODE_SENDS_PER_WINDOW} from './consts.ts'

/**
 * The registered Anon claim outlived its `anons` row. The caller mints a fresh
 * identity and retries once; the class is the control-flow signal, while
 * `failureCause` remains audit text.
 */
export class AnonNotFoundError extends Schema.TaggedError<
	AnonNotFoundError,
	{readonly brand: unique symbol}
>()('AnonNotFoundError', OpsErrorSchema) {}

const anonNotFoundFailure = createOpsFailure(AnonNotFoundError)

/**
 * A foreign-key violation on the insert can mean the registered anon row
 * vanished after the pre-check. The catch below asks whether that row is gone;
 * SQLSTATE 23503 excludes NOT NULL and CHECK violations, which stay internal.
 */
const isForeignKeyViolation = (error: EffectDrizzleQueryError | SchemaError) =>
	Schema.is(EffectDrizzleQueryError)(error) && extractPgCode(error) === '23503'

const _emailRequestPasscode = Effect.fn('emailRequestPasscode')(function* ({
	input: {email, intent},
	anonTokenPayload,
	userId,
	refreshToken,
	ipAddress,
}: {
	input: {email?: string; intent: (typeof PasscodeIntent)['Type']}
	anonTokenPayload: AnonTokenPayloadCustomClaims | null
	userId?: string
	refreshToken?: string
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

	if (!email && !userId)
		return yield* opsFailure({
			failureCause: 'INVALID_PARAMS',
			anonId: registeredAnonId,
			message: 'input: email is required when userId is absent',
		})

	/**
	 * User-keyed requests (reverify, email change) must come from a live refresh
	 * session, not just a still-valid access token. These paths send account
	 * mail, so a device revoked elsewhere must not be able to trigger them until
	 * the 15-minute access token and 5-minute sudo lease expire.
	 */
	if (userId) {
		/** A missing refresh token is a wiring error, not a dead session; fail as a defect. */
		if (!refreshToken)
			return yield* Effect.die(new Error('emailRequestPasscode: userId requires a refreshToken'))

		yield* verifyLiveSession({refreshToken, userId})
	}

	/**
	 * The registered claim is a cached assertion, not a guarantee: a token can
	 * outlive its row (cross-database dev cookie, branch reset, archive race). Check
	 * before hashing so a stale claim fails as a recoverable auth state, not an FK
	 * write after an Argon2 round-trip and email render.
	 */
	if (registeredAnonId) {
		const [anon] = yield* anonsQueries.select({id: registeredAnonId})

		if (!anon)
			return yield* anonNotFoundFailure({
				failureCause: 'ANON_NOT_FOUND',
				rateAllowance: Infinity,
				meta: {anonId: registeredAnonId},
				message: ANON_SESSION_EXPIRED_MESSAGE,
			})
	}

	/** Rate-limit check against ip address & id */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		anonId: registeredAnonId,
		failedCredential: email,
		userId,
	})

	if (currentBansAndExcessiveActivities.length)
		return yield* rateLimitFailure({
			message: EMAIL_REQUEST_GENERIC_FAILURE_MESSAGE,
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
				message: EMAIL_REQUEST_GENERIC_FAILURE_MESSAGE,
			})
		derivedEmail = user.email
	}

	/** email is guaranteed at this point: it's either provided, or derived from the user's notNull email */
	if (!derivedEmail)
		return yield* opsFailure({
			failureCause: 'MISSING_EMAIL',
			message: EMAIL_REQUEST_GENERIC_FAILURE_MESSAGE,
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

		const recipientExists =
			intent === 'reverify'
				? true
				: (yield* usersQueries.selectByEmail({email: derivedEmail})).length > 0

		const {send, appUrl} = yield* EmailService

		/**
		 * Only anon-keyed rows verify against the anon cookie; a User’s row
		 * verifies from any signed-in device.
		 */
		const anonBound = Boolean(registeredAnonId)

		/**
		 * Render the email before the verification row commits: a
		 * render failure fails the operation
		 */
		const {html, text, subject} = yield* Effect.tryPromise({
			try:
				/**
				 * Resolve which email to send. The row is always minted and the response
				 * shape is always the same, so neither timing nor delivery state leaks
				 * whether the address is registered. Only the inbox owner sees the
				 * flow-aware copy.
				 *
				 * The sign-in/new quadrant sends instructions instead of a code, but its
				 * row is still minted and kept: the identical Argon2 + insert work
				 * preserves timing uniformity and the row preserves the resend throttle.
				 */
				intent === 'sign-in' && !recipientExists
					? () => renderNoAccountFound(appUrl)
					: () =>
							renderVerificationEmail({
								code,
								appUrl,
								variant:
									intent === 'sign-up'
										? recipientExists
											? 'signup-existing'
											: 'signup'
										: 'signin',
								anonBound,
								expiresIn: PASSCODE_EXPIRATION,
							}),
			catch: (cause) =>
				opsFailure({
					failureCause: 'EMAIL_RENDER',
					userId,
					meta: extractErrorProps(cause),
					message: EMAIL_REQUEST_GENERIC_FAILURE_MESSAGE,
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
			/**
			 * Race backstop for the pre-check above: the anon row can disappear
			 * between the read and this insert. On a foreign-key violation, ask
			 * whether that row is gone; a missing User is a data bug, not a
			 * recoverable anon state.
			 */
			Effect.catchIf(isForeignKeyViolation, (drizzleError) =>
				Effect.gen(function* () {
					if (!registeredAnonId) return yield* drizzleError

					const [anon] = yield* anonsQueries.select({id: registeredAnonId})

					/** The row is still there, so another constraint failed; keep it internal */
					if (anon) return yield* drizzleError

					return yield* anonNotFoundFailure({
						failureCause: 'ANON_NOT_FOUND',
						rateAllowance: Infinity,
						meta: {anonId: registeredAnonId},
						message: ANON_SESSION_EXPIRED_MESSAGE,
					})
				}),
			),
		)

		/**
		 * A refused resend is a self-throttle, not a failed credential: the row is
		 * younger than the reset window, nothing was mailed, and the message tells
		 * the caller to wait. Charge no ban weight — a burst of clicks in a stale
		 * tab must not ban the account — and leave request-rate limiting to the
		 * per-network middleware. The insert above is the authoritative throttle, so a
		 * concurrent re-request still hashes and lands here.
		 */
		if (!data)
			return yield* opsFailure({
				anonId: registeredAnonId,
				userId,
				failedCredential: derivedEmail,
				failureCause: 'TOO_SOON_SINCE_LAST_RESET',
				rateAllowance: Infinity,
				message: PASSCODE_TOO_SOON_MESSAGE,
			})

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
						message: PASSCODE_SEND_FAILED_MESSAGE,
					})
				}),
			),
		)

		return {
			...data,
			/**
			 * `PASSCODE_SENDS_PER_WINDOW` sends per activity window per network and
			 * identity, enforced by the ban pipeline: the next pre-check denies and
			 * creates the bans. An Anon send weighs on IP + Anon; a session send
			 * weighs on IP + User, so a shared NAT can lose sign-in and refresh, and
			 * the account can lose refresh until the ban lifts. The per-network middleware
			 * is burst defense; this durable cap is the only per-account email-send
			 * bound.
			 */
			logging: {anonId: registeredAnonId, weight: allowRatePerWindow(PASSCODE_SENDS_PER_WINDOW)},
		}
	}).pipe(
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.provide(HashingStub.layer(hasherId)),
	)
})

export const emailRequestPasscode = createOpsFn({
	fn: _emailRequestPasscode,
	label: 'AUTH_STRATEGIES_EMAIL_REQUEST_PASSCODE',
})

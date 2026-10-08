import {DateTime, Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {extractPgError} from '#/db/ops/_extract-pg-error.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderEmailChangeConfirmation} from '#/email/templates/email-change-confirmation.tsx'
import {EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'

import {formatUserAgent} from './_user-agent.ts'
import {burnPasscode} from './email/_burn-passcode.ts'
import {verify} from './email/_verify.ts'

const genericFailureOutputMessage = 'Something went wrong. Please try again.'

const _emailChange = Effect.fn('emailChange')(function* ({
	input: {email: newEmail, passcode},
	ipAddress,
	userAgent,
	country,
	city,
	region,
	timezone,
	userId,
	sudoExpiresAt,
}: {
	input: (typeof EmailPasscodeCredentials)['Type']
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	userId: string
	sudoExpiresAt?: DateTime.Utc
}) {
	/** Ensure sudo privileges have not expired */
	if (!sudoExpiresAt || DateTime.isPastUnsafe(sudoExpiresAt)) {
		return yield* opsFailure({
			failureCause: 'STALE_VERIFICATION',
			userId,
			message: 'Your verification has expired. Re-verify, then try again.',
		})
	}

	/** Before processing, check if the ip address or user should be ratelimited */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		userId,
	})
	/**
	 * If active bans or excessive activities are found for the ip address
	 * log the activity as a rate limit failure and return a generic error
	 */
	if (currentBansAndExcessiveActivities.length)
		return yield* rateLimitFailure({message: genericFailureOutputMessage, userId})

	/** Find the user by id */
	const [user] = yield* usersQueries.select({id: userId})

	if (!user)
		return yield* opsFailure({
			failureCause: 'USER_NOT_FOUND',
			/** meta, not the userId column: the referenced user may no longer exist, which would violate the FK */
			meta: {userId},
			rateAllowance: 4,
			message: genericFailureOutputMessage,
		})

	/** The Email validator lowercases, so a case-insensitive compare is exact */
	if (user.email.toLowerCase() === newEmail.toLowerCase())
		return yield* opsFailure({
			failureCause: 'NOTHING_TO_UPDATE',
			userId,
			message: 'That is already your email address.',
		})

	/**
	 * Verify the passcode outside any transaction. Wrong codes persist their attempt
	 * and fail here; only a verified code proceeds to the authoritative transaction.
	 * The row is keyed by the NEW email + userId, proving control of the new address
	 */
	const verification = yield* verify({email: newEmail, passcode, userId})

	const db = yield* DB

	return yield* db.transaction((tx) =>
		Effect.gen(function* () {
			/** Burn the passcode so it cannot be reused. Fails if a concurrent submission or reset got there first */
			yield* burnPasscode({
				verification,
				userId,
				email: newEmail,
				tx,
			})

			/**
			 * The lower(email) unique index is authoritative for taken addresses.
			 * A race lost here surfaces as a generic error so callers cannot
			 * enumerate which addresses are registered
			 */
			const [rowData] = yield* usersQueries.updateEmail({id: userId, email: newEmail}, tx).pipe(
				Effect.catchTag('EffectDrizzleQueryError', (drizzleError) => {
					if (extractPgError(drizzleError) === 'UniqueViolation') return Effect.succeed([] as const)
					return Effect.fail(drizzleError)
				}),
			)

			if (!rowData)
				return yield* opsFailure({
					failureCause: 'EMAIL_UPDATE_FAILED',
					userId,
					failedCredential: newEmail,
					rateAllowance: 6,
					message: genericFailureOutputMessage,
				})

			/**
			 * Notify the OLD address as a side-effect so a takeover victim learns
			 * the account moved. Don't fail the operation on missend, but log it
			 */
			yield* Effect.gen(function* () {
				const {html, text, subject} = yield* Effect.tryPromise({
					try: () =>
						renderEmailChangeConfirmation({
							ipAddress,
							occurredAt: rowData.updatedAt,
							country,
							city,
							region,
							timezone,
							device: formatUserAgent(userAgent),
						}),
					catch: (cause) =>
						new EmailRenderError({
							message: cause instanceof Error ? cause.message : String(cause),
						}),
				})

				const {send} = yield* EmailService
				yield* send({to: user.email, subject, html, text})
			}).pipe(
				Effect.ignore({log: true, message: 'Failed to dispatch the email change confirmation'}),
			)

			return {email: rowData.email}
		}).pipe(Effect.provide(HashingStub.layer(userId))),
	)
})

export const emailChange = createOpsFn({
	fn: _emailChange,
	label: 'AUTH_EMAIL_CHANGE',
})

import {DateTime, Effect, Schema} from 'effect'

import {ArchiveCountMismatchError} from '#/db/helpers/archive-fns.ts'
import * as sessionsCascades from '#/db/models/sessions/cascades.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderPasswordChangeConfirmation} from '#/email/templates/password-change-confirmation.tsx'
import {PasswordChangeCredentials} from '#/isomorphic/validations/auth.ts'

import {generateAnonToken} from './_anon-token.ts'
import {hashTarget} from './_hashing.ts'
import {GENERIC_AUTH_FAILURE_MESSAGE, VERIFICATION_EXPIRED_MESSAGE} from './_messages.ts'
import {formatUserAgent} from './_user-agent.ts'
import {verifyLiveSession} from './_verify-live-session.ts'

const _passwordChange = Effect.fn('passwordChange')(function* ({
	input: {password, signOutAllSessions},
	ipAddress,
	userAgent,
	country,
	city,
	region,
	timezone,
	userId,
	sudoExpiresAt,
	refreshToken,
}: {
	input: (typeof PasswordChangeCredentials)['Type']
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	userId: string
	sudoExpiresAt?: DateTime.Utc
	refreshToken: string
}) {
	/** Ensure sudo privileges have not expired */
	if (!sudoExpiresAt || DateTime.isPastUnsafe(sudoExpiresAt)) {
		return yield* opsFailure({
			failureCause: 'STALE_VERIFICATION',
			userId,
			message: VERIFICATION_EXPIRED_MESSAGE,
		})
	}

	/** Ensure the refresh-token session is still live, not just the access token */
	yield* verifyLiveSession({refreshToken, userId})

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
		return yield* rateLimitFailure({message: GENERIC_AUTH_FAILURE_MESSAGE, userId})

	return yield* Effect.gen(function* () {
		const passwordHash = yield* hashTarget(password)

		const [rowData] = yield* usersQueries.updatePasswordHash({id: userId, passwordHash})

		if (!rowData)
			return yield* opsFailure({
				failureCause: 'PASSWORD_HASH_UPDATE_FAILED',
				rateAllowance: 6,
				message: GENERIC_AUTH_FAILURE_MESSAGE,
			})

		/**
		 * When requested, archive every active session for this user, including
		 * the one that made this request, so an attacker holding any of them
		 * loses access. Mirrors `signOutAll`: a concurrent sign-out may have
		 * already archived some (or all) rows, so a count mismatch is retried
		 * before treating the remainder as a no-op
		 */
		if (signOutAllSessions)
			yield* sessionsCascades.archiveByUser({userId}).pipe(
				Effect.retry({
					times: 3,
					while: (error) => Schema.is(ArchiveCountMismatchError)(error),
				}),
				Effect.catchTags({
					ArchiveNotFoundError: () => Effect.void,
					ArchiveCountMismatchError: () => Effect.void,
				}),
			)

		const anonToken = signOutAllSessions
			? yield* generateAnonToken({
					ipAddresses: [ipAddress],
					userAgents: [userAgent],
					countries: [country],
					cities: city ? [city] : [],
					regions: region ? [region] : [],
				})
			: undefined

		/**
		 * Send a confirmation email as a side-effect
		 *
		 * Don't fail whole operation on missend, but log the failure
		 */
		yield* Effect.gen(function* () {
			const {send, appUrl} = yield* EmailService

			const {html, text, subject} = yield* Effect.tryPromise({
				try: () =>
					renderPasswordChangeConfirmation({
						appUrl,
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

			yield* send({to: rowData.email, subject, html, text})
		}).pipe(
			Effect.ignore({log: true, message: 'Failed to dispatch the password change confirmation'}),
		)

		/**
		 * The anon token lets the server fn fall back to an anonymous identity
		 * after clearing the now-dead auth cookies. `undefined` keeps the op's
		 * output shape uniform for callers when sessions were left untouched
		 */
		return {anonToken}
	}).pipe(
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.provide(HashingStub.layer(userId)),
	)
})

export const passwordChange = createOpsFn({
	fn: _passwordChange,
	label: 'AUTH_PASSWORD_CHANGE',
})

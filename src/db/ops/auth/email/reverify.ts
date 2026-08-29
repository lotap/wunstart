import {DateTime, Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {generateAccessToken} from '#/db/ops/auth/_access-token.ts'
import {SUDO_EXPIRATION_WINDOW} from '#/db/ops/auth/consts.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import type {EmailReverifyCredentials} from '#/isomorphic/validations/auth.ts'

import {burnPasscode} from './_burn-passcode.ts'
import {verify} from './_verify.ts'

const genericFailureOutputMessage = 'Something went wrong. Please try again.'

/**
 * Verify a signed-in user with a passcode.
 * If it's valid create a fresh access token with a new sudoExpiresAt date
 */
const _emailReverify = Effect.fn('emailReverify')(function* ({
	input: {passcode},
	ipAddress,
	userId,
}: {
	input: (typeof EmailReverifyCredentials)['Type']
	ipAddress: string
	userId: string
}) {
	/** Before processing, check if the ip address or user should be ratelimited */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		userId,
	})
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

	/**
	 * Verify the passcode outside any transaction. Wrong codes persist their attempt
	 * and fail here; only a verified code proceeds to the authoritative transaction
	 */
	const verification = yield* verify({email: user.email, passcode, userId})

	const db = yield* DB

	return yield* db.transaction((tx) =>
		Effect.gen(function* () {
			/** Burn the passcode so it cannot be reused. Fails if a concurrent submission or reset got there first */
			yield* burnPasscode({
				verification,
				userId,
				email: user.email,
				tx,
			})

			const now = yield* DateTime.now
			const sudoExpiresAt = DateTime.add(now, {milliseconds: SUDO_EXPIRATION_WINDOW})

			/** Generate a new access token with verifiedAt set to now */
			const tokenData = yield* generateAccessToken({
				userId,
				sudoExpiresAt,
			})

			return {...tokenData, sudoExpiresAt}
		}).pipe(Effect.provide(HashingStub.layer(userId))),
	)
})

export const emailReverify = createOpsFn({
	fn: _emailReverify,
	label: 'AUTH_EMAIL_REVERIFY',
})

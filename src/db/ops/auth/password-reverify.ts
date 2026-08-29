import {DateTime, Effect} from 'effect'

import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {hashTarget, verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {PasswordReverifyCredentials} from '#/isomorphic/validations/auth.ts'

import {generateAccessToken} from './_access-token.ts'
import {needsRehash} from './_check-rehash.ts'
import {SUDO_EXPIRATION_WINDOW} from './consts.ts'

const genericFailureOutputMessage = 'That password doesn’t match. Double-check it and try again.'

/**
 * Verify a signed-in user's password.
 * If it's valid create a fresh access token with a new sudoExpiresAt date
 */
const _passwordReverify = Effect.fn('passwordReverify')(function* ({
	input: {password},
	ipAddress,
	userId,
}: {
	input: (typeof PasswordReverifyCredentials)['Type']
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

	const {passwordHash} = user

	if (!passwordHash)
		return yield* opsFailure({
			failureCause: 'NO_PASSWORD_ON_USER',
			userId,
			rateAllowance: 4,
			message: genericFailureOutputMessage,
		})

	/** Wrap in Effect.gen to provide the Hashing service to the internal Effects */
	return yield* Effect.gen(function* () {
		/** Verify the password against the stored hash */
		const isPasswordVerified = yield* verifyTarget(passwordHash, password)

		if (!isPasswordVerified)
			return yield* opsFailure({
				failureCause: 'WRONG_PASSWORD',
				userId,
				rateAllowance: 4,
				message: genericFailureOutputMessage,
			})

		/** Update the password hash if the hash config has changed */
		if (needsRehash(passwordHash)) {
			const newHash = yield* hashTarget(password)
			/**
			 * Compare-and-swap on the hash that was just verified: if a concurrent
			 * password change committed a newer hash in the meantime, the update
			 * matches zero rows and the newer password stays authoritative
			 */
			yield* retryTransientDb(
				usersQueries.updatePasswordHashIfMatches({
					id: userId,
					passwordHash,
					newHash,
				}),
			)
		}

		const sudoExpiresAt = DateTime.add(yield* DateTime.now, {milliseconds: SUDO_EXPIRATION_WINDOW})

		/** Generate a new access token with verifiedAt set to now */
		const tokenData = yield* generateAccessToken({
			userId,
			sudoExpiresAt,
		})

		return {...tokenData, sudoExpiresAt}
	}).pipe(Effect.provide(HashingStub.layer(userId)))
})

export const passwordReverify = createOpsFn({
	fn: _passwordReverify,
	label: 'AUTH_PASSWORD_REVERIFY',
})

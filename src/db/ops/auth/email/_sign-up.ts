import {Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {createUser} from '#/db/ops/auth/_create-user.ts'
import {generateNonce} from '#/db/ops/auth/_refresh-token.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'

import {burnPasscode} from './_burn-passcode.ts'
import {verify} from './_verify.ts'
import type {VerifyPasscodeContext} from './verify-passcode.ts'

export const signUpWithVerifiedCode = Effect.fn('emailVerifyPasscode.signUp')(function* ({
	verification,
	ctx: {email, ipAddress, userAgent, country, city, region, anonTokenPayload},
}: {
	verification: Effect.Success<ReturnType<typeof verify>>
	ctx: VerifyPasscodeContext
}) {
	const {id: anonId} = anonTokenPayload

	const db = yield* DB

	/**
	 * Generate the refresh nonce/hash through the AuthHasher DO before the
	 * transaction opens. Hashing must never run inside a database transaction
	 */
	const sessionNonce = yield* Effect.provide(generateNonce(), HashingStub.layer(anonId))

	return yield* retryTransientDb(
		db.transaction((tx) =>
			Effect.gen(function* () {
				/** Burn the passcode so it cannot be reused. Fails if a concurrent submission or reset got there first */
				yield* burnPasscode({
					verification,
					anonId,
					email,
					tx,
				})

				/** Create a user */
				const {user, session, access} = yield* createUser({
					input: {email},
					anonTokenPayload,
					ipAddress,
					userAgent,
					country,
					city,
					region,
					sessionNonce,
					tx,
				})

				yield* emailVerificationsQueries.archiveAddVerified(
					{id: verification.id, userId: user.id},
					tx,
				)

				return {session, access}
			}),
		),
	)
})

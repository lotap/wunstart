import type {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {DateTime, Effect} from 'effect'

import type {Tx} from '#/db/helpers/types.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {extractPgError} from '#/db/ops/_extract-pg-error.ts'
import type {NonceWithHash} from '#/db/ops/auth/_refresh-token.ts'
import {type OpsError, opsFailure} from '#/db/ops/ops-error.ts'

import {generateAccessToken} from './_access-token.ts'
import type {AnonTokenPayloadCustomClaims} from './_anon-token.ts'
import {createSession} from './_create-session.ts'
import {retireAnon} from './_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from './consts.ts'

type CreateUserInput = {
	email: string
	/** Must be hashed before reaching this op. Hashing never runs inside the caller's transaction */
	passwordHash?: string | null
}

export const createUser = Effect.fn('createUser')(function* ({
	input: {email, passwordHash},
	anonTokenPayload,
	ipAddress,
	sessionNonce,
	tx,
}: {
	input: CreateUserInput
	anonTokenPayload: AnonTokenPayloadCustomClaims
	ipAddress: string
	/** Generated via `generateNonce` before the caller's transaction opened */
	sessionNonce: NonceWithHash
	tx: Tx
}) {
	const {id: anonId} = anonTokenPayload

	/** Attempt to add a user */
	const [user] = yield* usersQueries
		.insert(
			{
				email,
				passwordHash,
			},
			tx,
		)
		.pipe(
			Effect.catchTag(
				'EffectDrizzleQueryError',
				(drizzleError): Effect.Effect<never, OpsError | EffectDrizzleQueryError> => {
					/**
					 * If a user already exists with the given credential, return specified error
					 * https://www.postgresql.org/docs/current/errcodes-appendix.html#ERRCODES-TABLE
					 */
					if (extractPgError(drizzleError) === 'UniqueViolation')
						return Effect.fail(
							opsFailure({
								failureCause: 'USER_ALREADY_EXISTS',
								failedCredential: email,
								anonId: anonId,
								rateAllowance: 5,
								message: 'That email already has an account. Try signing in instead.',
							}),
						)

					return Effect.fail(drizzleError)
				},
			),
		)

	// should be unreachable, drizzle throws on failed insert but it makes the linter happy
	if (!user) return yield* Effect.die(new Error('Problem inserting user'))

	const {id: userId} = user

	const now = yield* DateTime.now

	/** Concurrently create a session, archive the anon token if it exists, and generate an access token */
	const [session, anonsArchive, access] = yield* Effect.all(
		[
			createSession({userId, ipAddress, ...sessionNonce}, tx),
			retireAnon({tokenData: anonTokenPayload, userId, ipAddress}, tx),
			generateAccessToken({
				userId,
				sudoExpiresAt: DateTime.add(now, {milliseconds: SUDO_EXPIRATION_WINDOW}),
			}),
		],
		{concurrency: 'unbounded'},
	)

	return {
		user,
		session,
		anonsArchive,
		access,
	}
})

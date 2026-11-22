import type {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {DateTime, Effect, Schema} from 'effect'

import type {Tx} from '#/db/helpers/types.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {extractPgError} from '#/db/ops/_extract-pg-error.ts'
import {retireAnon} from '#/db/ops/auth/anons/_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from '#/db/ops/auth/consts.ts'
import {EMAIL_ALREADY_REGISTERED_MESSAGE} from '#/db/ops/auth/messages.ts'
import {createSession} from '#/db/ops/auth/sessions/_create-session.ts'
import {generateAccessToken} from '#/db/ops/auth/tokens/_access-token.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/tokens/_anon-token.ts'
import type {NonceWithHash} from '#/db/ops/auth/tokens/_refresh-token.ts'
import {createOpsFailure, OpsErrorSchema} from '#/db/ops/ops-error.ts'

/**
 * The email already belongs to an account. The verify flow catches this to fall
 * back to sign-in after losing a creation race; the class is the control-flow
 * signal, while `failureCause` remains audit text.
 */
export class UserAlreadyExistsError extends Schema.TaggedError<
	UserAlreadyExistsError,
	{readonly brand: unique symbol}
>()('UserAlreadyExistsError', OpsErrorSchema) {}

const userAlreadyExistsFailure = createOpsFailure(UserAlreadyExistsError)

type CreateUserInput = {
	email: string
	/** Must be hashed before reaching this op. Hashing never runs inside the caller's transaction */
	passwordHash?: string | null
}

export const createUser = Effect.fn('createUser')(function* ({
	input: {email, passwordHash},
	anonTokenPayload,
	ipAddress,
	userAgent,
	country,
	city,
	region,
	sessionNonce,
	tx,
}: {
	input: CreateUserInput
	anonTokenPayload: AnonTokenPayloadCustomClaims
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
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
				(drizzleError): Effect.Effect<never, UserAlreadyExistsError | EffectDrizzleQueryError> => {
					/**
					 * If a user already exists with the given credential, return specified error
					 * https://www.postgresql.org/docs/current/errcodes-appendix.html#ERRCODES-TABLE
					 */
					if (extractPgError(drizzleError) === 'UniqueViolation')
						return Effect.fail(
							userAlreadyExistsFailure({
								failureCause: 'USER_ALREADY_EXISTS',
								failedCredential: email,
								anonId: anonId,
								rateAllowance: 5,
								message: EMAIL_ALREADY_REGISTERED_MESSAGE,
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
			createSession({userId, ipAddress, userAgent, country, city, region, ...sessionNonce}, tx),
			retireAnon(
				{tokenData: anonTokenPayload, userId, ipAddress, userAgent, country, city, region},
				tx,
			),
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

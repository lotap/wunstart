import {DateTime, Effect} from 'effect'

import type {Tx} from '#/db/helpers/types.ts'
import * as sessionsQueries from '#/db/models/sessions/queries.ts'

import type {NonceWithHash} from './_refresh-token.ts'
import {generateRefreshToken} from './_refresh-token.ts'

/**
 * Inserts a session row from a precomputed {@link NonceWithHash} and signs its refresh token.
 *
 * The nonce must be generated via `generateNonce` BEFORE opening the transaction.
 * Its hash runs on the AuthHasher Durable Object (~hundreds of ms), and holding a
 * database transaction open across that call both stalls the connection pool and
 * forces the hashing work to repeat on every transient-DB retry
 */
export const createSession = Effect.fn('createSession')(function* (
	{
		userId,
		ipAddress,
		userAgent,
		nonce,
		nonceHash,
	}: {userId: string; ipAddress: string; userAgent: string} & NonceWithHash,
	tx: Tx,
) {
	const [session] = yield* sessionsQueries.insert({userId, ipAddress, userAgent, nonceHash}, tx)

	// should be unreachable, drizzle throws on failed insert but it makes the linter happy
	if (!session) return yield* Effect.die(new Error('Problem inserting session'))

	/** convert returned Date to DateTimeUtc */
	const expiresAt = DateTime.fromDateUnsafe(session.expiresAt)

	const refreshToken = yield* generateRefreshToken({
		exp: expiresAt,
		sessionId: session.id,
		generation: session.refreshGeneration,
		nonce,
	})

	return {...session, expiresAt, refreshToken}
})

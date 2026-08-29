import {Effect} from 'effect'

import {archive as archiveSession} from '#/db/models/sessions/cascades.ts'
import * as sessionsQueries from '#/db/models/sessions/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'

import {generateAnonToken} from './_anon-token.ts'
import {extractRefreshTokenPayload} from './_refresh-token.ts'

/**
 * Remove session and add it to sessionsArchive
 *
 * Checks if the user has a valid session/refresh token first to ensure
 * that an attacker can not arbitrarily remove random sessions
 */
const _signOut = Effect.fn('signOut')(function* ({
	token,
	ipAddress,
	userAgent,
}: {
	token: string
	ipAddress: string
	userAgent: string
}) {
	const {nonce, sessionId} = yield* extractRefreshTokenPayload(token).pipe(
		Effect.mapError(({operation}) =>
			opsFailure({
				failureCause: 'INVALID_JWS',
				meta: {operation},
				rateAllowance: 3,
			}),
		),
	)

	/** Find the session by id */
	const [session] = yield* sessionsQueries.select({id: sessionId})

	/** If the session is not found, throw an associated error */
	if (!session)
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			meta: {sessionId},
			rateAllowance: 3,
		})

	const {nonceHash, userId} = session

	/** Ensure the refresh token matches the hashed one stored in the database */
	const isNonceVerified = yield* verifyTarget(nonceHash, nonce).pipe(
		Effect.provide(HashingStub.layer(userId)),
	)

	/** If the refresh token doesn't match, throw an associated error */
	if (!isNonceVerified)
		return yield* opsFailure({
			failureCause: 'WRONG_NONCE',
			rateAllowance: 3,
		})

	/**
	 * Archive the session. A concurrent sign-out or sign-out-all may have already
	 * archived it (the archive delete is count-verified, so a race rolls the
	 * transaction back rather than half-archiving), which is still a successful
	 * sign-out. Treat it as a no-op rather than an error
	 */
	yield* archiveSession({id: sessionId}).pipe(
		Effect.catchTags({
			ArchiveNotFoundError: () => Effect.void,
			ArchiveCountMismatchError: () => Effect.void,
		}),
	)

	/** Create a new anon token */
	const anonToken = yield* generateAnonToken({ipAddresses: [ipAddress], userAgents: [userAgent]})

	return {anonToken}
})

export const signOut = createOpsFn({fn: _signOut, label: 'AUTH_SIGN_OUT'})

import {Effect} from 'effect'

import {archive as archiveSession} from '#/db/models/sessions/cascades.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {SESSION_EXPIRED_MESSAGE} from '#/isomorphic/auth-messages.ts'

import {generateAnonToken} from './_anon-token.ts'
import {decodeRefreshSession} from './_refresh-session.ts'
import {verifyRefreshNonce} from './_verify-refresh-nonce.ts'

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
	country,
	city,
	region,
}: {
	token: string
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	const resolved = yield* decodeRefreshSession({token})

	/**
	 * Revoked/expired/invalid tokens are terminal states the handler completes
	 * locally, so they keep the audit row but carry no ban weight (a few stale
	 * devices behind one IP must not lock it out)
	 */
	if (resolved.status === 'invalid')
		return yield* opsFailure({
			failureCause: 'INVALID_JWS',
			meta: {operation: resolved.operation},
			rateAllowance: Infinity,
			message: SESSION_EXPIRED_MESSAGE,
		})

	if (resolved.status === 'missing')
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			meta: {sessionId: resolved.sessionId},
			rateAllowance: Infinity,
			message: SESSION_EXPIRED_MESSAGE,
		})

	const {generation, nonce, session} = resolved

	const {userId} = session

	/** Ensure the refresh token matches the hash (or grace nonce) stored in the database */
	const nonceCheck = yield* verifyRefreshNonce({session, generation, nonce})

	/** If the refresh token doesn't match, throw an associated error */
	if (nonceCheck !== 'match')
		return yield* opsFailure({
			failureCause: 'WRONG_NONCE',
			/** Same terminal-state handling: no ban weight for a sign-out the handler completes locally */
			rateAllowance: Infinity,
			userId,
			message: SESSION_EXPIRED_MESSAGE,
		})

	/**
	 * Archive the session. A concurrent sign-out or sign-out-all may have already
	 * archived it (the archive delete is count-verified, so a race rolls the
	 * transaction back rather than half-archiving), which is still a successful
	 * sign-out. Treat it as a no-op rather than an error
	 */
	yield* archiveSession({id: session.id}).pipe(
		Effect.catchTags({
			ArchiveNotFoundError: () => Effect.void,
			ArchiveCountMismatchError: () => Effect.void,
		}),
	)

	/** Create a new anon token */
	const anonToken = yield* generateAnonToken({
		ipAddresses: [ipAddress],
		userAgents: [userAgent],
		countries: [country],
		cities: city ? [city] : [],
		regions: region ? [region] : [],
	})

	return {anonToken, logging: {userId}}
})

export const signOut = createOpsFn({fn: _signOut, label: 'AUTH_SIGN_OUT'})

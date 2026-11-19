import {Effect} from 'effect'

import {opsFailure} from '#/db/ops/ops-error.ts'

import {decodeRefreshSession} from './_refresh-session.ts'

/**
 * Reject an authenticated action whose refresh-token session is no longer live.
 *
 * The access token proves userId + sudo, but it remains valid for up to 15
 * minutes after `signOutAll` archives the session row. Sudo-gated mutations,
 * user-keyed passcode requests, and the two reverify ops call this before
 * acting or minting a replacement token. The refresh token is signed and
 * carries the sessionId; a plain PK lookup is enough here.
 * `decodeRefreshSession` verifies the refresh JWS signature itself
 * (`verifyAuth` only verifies the access token); only the nonce hash is skipped:
 * that costs an Argon2 DO round-trip, and no path here rotates the session.
 */
export const verifyLiveSession = Effect.fn('verifyLiveSession')(function* ({
	refreshToken,
	userId,
}: {
	refreshToken: string
	userId: string
}) {
	const message = 'Your session has expired. Sign in and try again.'

	const resolved = yield* decodeRefreshSession({token: refreshToken})

	if (resolved.status === 'invalid')
		return yield* opsFailure({
			failureCause: 'INVALID_JWS',
			meta: {operation: resolved.operation},
			rateAllowance: 3,
			message,
		})

	/**
	 * `userId` is already known from the access token: keep the activity
	 * attributed, but charge no ban weight. A device lands here by using the
	 * product after a remote sign-out-all or a password change on another
	 * device; the mutation is rejected either way, and three retries must not
	 * create a USER ban that blocks the user's own refresh and sign-in.
	 */
	if (resolved.status === 'missing')
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			userId,
			meta: {sessionId: resolved.sessionId},
			rateAllowance: Infinity,
			message,
		})

	const {session} = resolved

	/**
	 * Keep this comparison in JS: filtering by `userId` in the query would
	 * silently turn a charged mismatch into a weight-0 missing session.
	 */
	if (session.userId !== userId)
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			userId,
			rateAllowance: 3,
			message,
		})
})

import {Effect} from 'effect'

import {opsFailure} from '#/db/ops/ops-error.ts'
import {SESSION_EXPIRED_MESSAGE} from '#/isomorphic/auth-messages.ts'

import {decodeRefreshSession} from './_refresh-session.ts'

/**
 * Reject an authenticated action whose refresh-token session is no longer live.
 *
 * The access token proves userId + sudo, but it remains valid for up to 15
 * minutes after `signOutAll` archives the session row. Any action that mutates
 * account state, sends account email, or mints a replacement token calls this
 * before acting; `signOutAll` does the equivalent check alongside its nonce
 * work. The refresh token is signed and carries the sessionId; a plain PK
 * lookup is enough here. `decodeRefreshSession` verifies the refresh JWS
 * signature itself
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
	const resolved = yield* decodeRefreshSession({token: refreshToken})

	/**
	 * A refresh JWS that does not verify is not evidence of abuse: a rotated
	 * secret set and a corrupted cookie produce the same failure, and the access
	 * token already proves who is asking. Attribute it to the user, but charge no
	 * ban weight: the action is rejected either way, and three retries must not
	 * ban the account over a cookie that cannot be used (same rule as the
	 * undecodable grace token in the refresh op).
	 */
	if (resolved.status === 'invalid')
		return yield* opsFailure({
			failureCause: 'INVALID_JWS',
			userId,
			meta: {operation: resolved.operation},
			rateAllowance: Infinity,
			message: SESSION_EXPIRED_MESSAGE,
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
			message: SESSION_EXPIRED_MESSAGE,
		})

	const {session} = resolved

	/**
	 * A session owned by another user cannot vouch for this access token's
	 * session, so the pair is mixed or corrupted and the action fails closed.
	 * Charge no ban weight: the mismatch authorizes nothing, and the access-token
	 * user is not the party who supplied the foreign cookie — cookie tossing from
	 * a sibling host produces the same state, so a cookie they cannot control
	 * must not ban their account.
	 */
	if (session.userId !== userId)
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			userId,
			meta: {sessionId: session.id},
			rateAllowance: Infinity,
			message: SESSION_EXPIRED_MESSAGE,
		})
})

import {Effect, Schema} from 'effect'

import {ArchiveCountMismatchError} from '#/db/helpers/archive-fns.ts'
import {archiveByUser} from '#/db/models/sessions/cascades.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {SIGN_OUT_ALL_FAILED_MESSAGE} from '#/isomorphic/auth-messages.ts'

import {generateAnonToken} from './_anon-token.ts'
import {decodeRefreshSession} from './_refresh-session.ts'
import {verifyRefreshNonce} from './_verify-refresh-nonce.ts'
import {REFRESH_FAILURE_CAUSES, REFRESH_NONCE_CHECK_CAUSES} from './refresh-token-policies.ts'

/**
 * Remove all sessions for a user based on the given refresh token. Used to sign-out on all devices.
 *
 * Verifies that the caller holds a live, unrevoked session for the authenticated user
 * first, so an already-evicted session still holding an unexpired 15-minute access
 * token cannot repeatedly invoke `signOutAll` in a watcher loop as the account owner
 * signs back in. The user binding also fails closed on mixed cookies: the refresh
 * token must belong to the user the access token proved.
 */
const _signOutAll = Effect.fn('signOutAll')(function* ({
	token,
	userId,
	ipAddress,
	userAgent,
	country,
	city,
	region,
}: {
	token: string
	userId: string
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	const resolved = yield* decodeRefreshSession({token})

	/**
	 * An unusable refresh JWS is not evidence of abuse: it may be expired, from a
	 * rotated secret set, or corrupted, and the access token already proved who is
	 * asking. Attribute it to the user, but charge no ban weight — a few retries
	 * must not ban the caller’s IP over a token that cannot be used.
	 */
	if (resolved.status === 'invalid')
		return yield* opsFailure({
			failureCause: REFRESH_FAILURE_CAUSES[resolved.reason],
			userId,
			meta: {operation: resolved.operation},
			rateAllowance: Infinity,
			message: SIGN_OUT_ALL_FAILED_MESSAGE,
		})

	/**
	 * Revoked/expired is a terminal state a user reaches by signing out
	 * elsewhere, not an attack signal. Surface the failure, but charge no
	 * ban weight: a few stale devices behind one IP must not lock it out.
	 * The access token already proved `userId`, so keep that attribution;
	 * the liveness check alone stops the post-eviction watcher loop.
	 */
	if (resolved.status === 'missing')
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			userId,
			meta: {sessionId: resolved.sessionId},
			rateAllowance: Infinity,
			message: SIGN_OUT_ALL_FAILED_MESSAGE,
		})

	const {generation, nonce, session} = resolved

	const {userId: sessionUserId} = session

	/**
	 * The access token proved `userId`; bind the refresh session to it so mixed
	 * cookies fail closed instead of archiving another user’s sessions. Compare
	 * before the nonce check: a mismatched token does not need a hasher round-trip.
	 * Charge no ban weight: the mismatch authorizes nothing, and the access-token
	 * user is not the party who supplied the foreign cookie — cookie tossing from
	 * a sibling host produces the same state, so it must not ban their account.
	 */
	if (sessionUserId !== userId)
		return yield* opsFailure({
			failureCause: 'SESSION_USER_MISMATCH',
			userId,
			meta: {sessionId: session.id},
			rateAllowance: Infinity,
			message: SIGN_OUT_ALL_FAILED_MESSAGE,
		})

	const nonceCheck = yield* verifyRefreshNonce({session, generation, nonce})

	if (nonceCheck !== 'match')
		return yield* opsFailure({
			failureCause: REFRESH_NONCE_CHECK_CAUSES[nonceCheck],
			/**
			 * A nonce check failure cannot archive anything: the access token already
			 * bound the caller to this user, and the stale generation is reachable
			 * from ordinary rotation or theft. Keep the strict error, but charge no
			 * ban weight — this action exists to recover from theft, and a USER ban
			 * would refuse the refresh it needs.
			 */
			rateAllowance: Infinity,
			userId,
			message: SIGN_OUT_ALL_FAILED_MESSAGE,
		})

	/**
	 * Archive all of the user's sessions. A concurrent sign-out or sign-out-all may
	 * have already archived some. A count mismatch means another sign-out raced us,
	 * so retry to archive whatever is still active before treating the remainder as a no-op
	 */
	yield* archiveByUser({userId: sessionUserId}).pipe(
		Effect.retry({
			times: 3,
			while: (error) => Schema.is(ArchiveCountMismatchError)(error),
		}),
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

	return {anonToken, logging: {userId: sessionUserId}}
})

export const signOutAll = createOpsFn({
	fn: _signOutAll,
	label: 'AUTH_SIGN_OUT_ALL',
})

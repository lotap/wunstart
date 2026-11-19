import {Effect, Schema} from 'effect'

import {ArchiveCountMismatchError} from '#/db/helpers/archive-fns.ts'
import {archiveByUser} from '#/db/models/sessions/cascades.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'

import {generateAnonToken} from './_anon-token.ts'
import {decodeRefreshSession} from './_refresh-session.ts'
import {verifyRefreshNonce} from './_verify-refresh-nonce.ts'

/**
 * Remove all sessions for a user based on the given refresh token. Used to sign-out on all devices.
 *
 * Verifies that the caller holds a live, unrevoked session in the database first so an
 * already-evicted session still holding an unexpired 15-minute access token cannot
 * repeatedly invoke `signOutAll` in a watcher loop as the account owner signs back in.
 */
const _signOutAll = Effect.fn('signOutAll')(function* ({
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
	const message = 'Your session has expired. Sign in and try again.'

	const resolved = yield* decodeRefreshSession({token})

	if (resolved.status === 'invalid')
		return yield* opsFailure({
			failureCause: 'INVALID_JWS',
			meta: {operation: resolved.operation},
			rateAllowance: 3,
			message,
		})

	/**
	 * Revoked/expired is a terminal state a user reaches by signing out
	 * elsewhere, not an attack signal. Surface the failure, but charge no
	 * ban weight: a few stale devices behind one IP must not lock it out.
	 * The liveness check alone stops the post-eviction watcher loop.
	 */
	if (resolved.status === 'missing')
		return yield* opsFailure({
			failureCause: 'SESSION_NOT_FOUND',
			meta: {sessionId: resolved.sessionId},
			rateAllowance: Infinity,
			message,
		})

	const {generation, nonce, session} = resolved

	const {userId} = session

	const nonceCheck = yield* verifyRefreshNonce({session, generation, nonce})

	if (nonceCheck !== 'match')
		return yield* opsFailure({
			failureCause: 'WRONG_NONCE',
			/**
			 * An undecodable grace token is config/corruption, not user abuse:
			 * same weight-0 rule as refresh. A nonce mismatch stays charged.
			 */
			rateAllowance: nonceCheck === 'grace-unreadable' ? Infinity : 3,
			userId,
			message,
		})

	/**
	 * Archive all of the user's sessions. A concurrent sign-out or sign-out-all may
	 * have already archived some. A count mismatch means another sign-out raced us,
	 * so retry to archive whatever is still active before treating the remainder as a no-op
	 */
	yield* archiveByUser({userId}).pipe(
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

	return {anonToken, logging: {userId}}
})

export const signOutAll = createOpsFn({
	fn: _signOutAll,
	label: 'AUTH_SIGN_OUT_ALL',
})

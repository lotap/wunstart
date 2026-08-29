import {Effect, Schema} from 'effect'

import {ArchiveCountMismatchError} from '#/db/helpers/funcs.ts'
import {archiveByUser} from '#/db/models/sessions/cascades.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'

import {extractAccessTokenPayload} from './_access-token.ts'
import {generateAnonToken} from './_anon-token.ts'

/** Remove all sessions for a user based on the given accessToken. Used to sign-out on all devices. */
const _signOutAll = Effect.fn('signOutAll')(function* ({
	accessToken,
	ipAddress,
	userAgent,
}: {
	accessToken: string
	ipAddress: string
	userAgent: string
}) {
	/** Validate access token and get user id */
	const {userId} = yield* extractAccessTokenPayload(accessToken).pipe(
		Effect.mapError(({operation}) =>
			opsFailure({
				failureCause: 'INVALID_JWE',
				meta: {operation},
				rateAllowance: 3,
			}),
		),
	)

	/**
	 * Archive all of the user's sessions. A concurrent sign-out or sign-out-all may
	 * have already archived some (or the user may have no sessions at all). No rows
	 * is still a successful sign-out, so treat it as a no-op. A count mismatch means
	 * another sign-out raced us, so retry to archive whatever is still active before
	 * treating the remainder as a no-op
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
	const anonToken = yield* generateAnonToken({ipAddresses: [ipAddress], userAgents: [userAgent]})

	return {anonToken}
})

export const signOutAll = createOpsFn({
	fn: _signOutAll,
	label: 'AUTH_SIGN_OUT_ALL',
})

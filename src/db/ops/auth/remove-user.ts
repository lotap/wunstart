import {DateTime, Effect} from 'effect'

import {archive as archiveUser} from '#/db/models/users/cascades.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'

import {generateAnonToken} from './_anon-token.ts'

const genericFailureOutputMessage = 'Something went wrong. Please try again.'

/**
 * Remove the signed-in user's account.
 *
 * Requires fresh identity verification (sudo). A stale one must re-verify via
 * password-reverify/email-reverify first. The archival cascades archive the
 * user's sessions and email verifications and re-point activities/bans to the
 * users_archive row; the success activity this op logs afterwards resolves its
 * own userId to the users_archive id when the FK proves the row has moved
 */
const _removeUser = Effect.fn('removeUser')(function* ({
	ipAddress,
	userId,
	sudoExpiresAt,
}: {
	ipAddress: string
	userId: string
	sudoExpiresAt?: DateTime.Utc
}) {
	/** Ensure sudo privileges have not expired */
	if (!sudoExpiresAt || DateTime.isPastUnsafe(sudoExpiresAt)) {
		return yield* opsFailure({
			failureCause: 'STALE_VERIFICATION',
			userId,
			message: 'Your verification has expired. Re-verify, then try again.',
		})
	}

	/** Before processing, check if the ip address or user should be ratelimited */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		userId,
	})
	/**
	 * If active bans or excessive activities are found for the ip address
	 * log the activity as a rate limit failure and return a generic error
	 */
	if (currentBansAndExcessiveActivities.length)
		return yield* rateLimitFailure({message: genericFailureOutputMessage, userId})

	/**
	 * Archive the user. A concurrent removal (another device/tab) may have
	 * archived it already, but the desired end state (no active account) holds
	 * either way, so treat that as a no-op success
	 */
	yield* archiveUser({id: userId}).pipe(Effect.catchTag('ArchiveNotFoundError', () => Effect.void))

	/** Create a new anon token so the client leaves with a clean anonymous identity */
	const anonToken = yield* generateAnonToken({ipAddresses: [ipAddress]})

	return {anonToken}
})

export const removeUser = createOpsFn({
	fn: _removeUser,
	label: 'AUTH_REMOVE_USER',
})

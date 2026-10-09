import {DateTime, Effect} from 'effect'

import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'

const _getUserEmail = Effect.fn('getUserEmail')(function* ({
	userId,
	sudoExpiresAt,
}: {
	userId: string
	sudoExpiresAt?: DateTime.Utc
}) {
	/** The full address is only served to a freshly verified session */
	if (!sudoExpiresAt || DateTime.isPastUnsafe(sudoExpiresAt)) {
		return yield* opsFailure({
			failureCause: 'STALE_VERIFICATION',
			userId,
			message: 'Your verification has expired. Re-verify, then try again.',
		})
	}

	const [user] = yield* usersQueries.select({id: userId})

	if (!user)
		return yield* opsFailure({
			failureCause: 'USER_NOT_FOUND',
			/** meta, not the userId column: the referenced user may no longer exist, which would violate the FK */
			meta: {userId},
			rateAllowance: 6,
			message: 'Something went wrong. Please try again.',
		})

	return {email: user.email}
})

export const getUserEmail = createOpsFn({
	fn: _getUserEmail,
	label: 'AUTH_GET_USER_EMAIL',
})

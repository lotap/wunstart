import {Effect} from 'effect'

import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'

const _getUserProfile = Effect.fn('getUserProfile')(function* ({userId}: {userId: string}) {
	const [user] = yield* usersQueries.selectProfile({id: userId})
	if (!user)
		return yield* opsFailure({
			failureCause: 'USER_NOT_FOUND',
			/** meta, not the userId column: the referenced user may no longer exist, which would violate the FK */
			meta: {userId},
			rateAllowance: 6,
			message: 'Something went wrong. Please try again.',
		})
	return user
})

export const getUserProfile = createOpsFn({
	fn: _getUserProfile,
	label: 'AUTH_GET_USER_PROFILE',
})

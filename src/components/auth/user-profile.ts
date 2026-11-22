import {queryOptions} from '@tanstack/react-query'
import type {useServerFn} from '@tanstack/react-start'

import type {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

/** The signed-in user’s profile query. */
export const userProfileQueryOptions = ({
	serverFn,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleGetUserProfile>>
}) =>
	queryOptions({
		queryKey: ['userProfile'],
		queryFn: () => serverFn(),
		staleTime: Infinity,
	})

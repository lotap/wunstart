import {useQueryClient} from '@tanstack/react-query'
import {useRouter} from '@tanstack/react-router'
import {useEffect} from 'react'

import {authTransitionStorageKey} from '#/components/auth/_utils.ts'

/**
 * Keep the query cache in sync with auth changes made by another tab.
 *
 * Cookies are shared across tabs but React Query is not: a sign-in, sign-out,
 * or account removal in one tab leaves the others holding the previous
 * identity’s profile, session list, and sudo-gated email. `clearIdentityCache`
 * writes a storage marker; this listener drops the cache and refreshes the
 * router here.
 */
export function useAuthCacheSync() {
	const queryClient = useQueryClient()
	const router = useRouter()

	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== authTransitionStorageKey) return

			/**
			 * Clear directly instead of calling `clearIdentityCache`: that would
			 * write another marker and ping-pong between tabs.
			 */
			queryClient.clear()
			void router.invalidate().catch(() => undefined)
		}

		window.addEventListener('storage', handleStorage)

		return () => window.removeEventListener('storage', handleStorage)
	}, [queryClient, router])
}

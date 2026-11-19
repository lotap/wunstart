import {useQueryClient} from '@tanstack/react-query'
import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {clearIdentityCache} from '#/components/auth/_utils.ts'
import {toast} from '#/components/ui/toast.tsx'
import {handleSignOut} from '#/server-fns/handle-sign-out.ts'

export function useSignOut() {
	const router = useRouter()
	const queryClient = useQueryClient()
	const signOutFn = useServerFn(handleSignOut)

	return async () => {
		try {
			await signOutFn()
			clearIdentityCache(queryClient)
			await router.invalidate()
		} catch (error) {
			toast.add({
				type: 'error',
				title: 'Sign out failed',
				description: error instanceof Error ? error.message : 'Please try again.',
			})
		}
	}
}

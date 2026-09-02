import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {toast} from '#/components/ui/toast.tsx'
import {handleSignOut} from '#/server-fns/handle-sign-out.ts'

export function useSignOut() {
	const router = useRouter()
	const signOutFn = useServerFn(handleSignOut)

	return async () => {
		try {
			await signOutFn()
			await router.invalidate()
		} catch (error) {
			toast.add({
				type: 'error',
				title: 'Sign Out Failed',
				description: error instanceof Error ? error.message : 'Please try again.',
			})
		}
	}
}

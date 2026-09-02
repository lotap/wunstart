import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {toast} from '#/components/ui/toast.tsx'
import {handleSignOutAll} from '#/server-fns/handle-sign-out-all.ts'

export function useSignOutAll() {
	const router = useRouter()
	const signOutAllFn = useServerFn(handleSignOutAll)

	return async () => {
		try {
			await signOutAllFn()
			await router.invalidate()
		} catch (error) {
			toast.add({
				type: 'error',
				title: 'Sign Out All Failed',
				description: error instanceof Error ? error.message : 'Please try again.',
			})
		}
	}
}

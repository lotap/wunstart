import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {handleSignOutAll} from '#/server-fns/handle-sign-out-all.ts'

export function useSignOutAll() {
	const router = useRouter()
	const signOutAllFn = useServerFn(handleSignOutAll)

	return async () => {
		await signOutAllFn()
		await router.invalidate()
	}
}

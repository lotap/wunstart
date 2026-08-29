import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {handleSignOut} from '#/server-fns/handle-sign-out.ts'

export function useSignOut() {
	const router = useRouter()
	const signOutFn = useServerFn(handleSignOut)

	return async () => {
		await signOutFn()
		await router.invalidate()
	}
}

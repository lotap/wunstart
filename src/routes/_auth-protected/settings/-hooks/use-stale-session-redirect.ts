import {useQueryClient} from '@tanstack/react-query'
import {useRouter} from '@tanstack/react-router'
import {useEffect, useRef} from 'react'

import {clearIdentityCache} from '#/components/auth/identity-cache.ts'

/**
 * An empty sessions result means this device has no live Session for the User —
 * the session is missing, revoked, or expired, the refresh token belongs to
 * another User, or the JWS is unreadable — and the handler has already cleared
 * the auth cookies. Drop the dead identity’s cached data, then refresh the
 * router once so the root auth check runs without those cookies and the route
 * guard redirects to sign-in.
 */
export function useStaleSessionRedirect(isEmpty: boolean) {
	const router = useRouter()
	const queryClient = useQueryClient()
	const requested = useRef(false)

	useEffect(() => {
		if (!isEmpty || requested.current) return

		requested.current = true

		clearIdentityCache(queryClient)

		/**
		 * A failed refresh leaves the cookies cleared server-side; the next
		 * navigation or reload re-runs the guard. Do not retry in a loop.
		 */
		void router.invalidate().catch(() => undefined)
	}, [isEmpty, queryClient, router])
}

import {createFileRoute, redirect, Outlet} from '@tanstack/react-router'

import {HasSudoProvider} from '#/contexts/has-sudo.tsx'
import {handleVerifyAuth} from '#/server-fns/handle-verify-auth.ts'

export const Route = createFileRoute('/_auth-protected')({
	beforeLoad: async ({location}) => {
		const auth = await handleVerifyAuth()

		if (!auth) {
			throw redirect({
				to: '/sign-in',
				// Save current location for redirect after sign-in
				search: {redirect: location.href},
			})
		}

		return {auth}
	},
	component: AuthProtected,
})

function AuthProtected() {
	const {auth} = Route.useRouteContext()
	return (
		<HasSudoProvider initialSudoExpiresAt={auth.sudoExpiresAt}>
			<Outlet />
		</HasSudoProvider>
	)
}

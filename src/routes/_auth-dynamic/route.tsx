import {createFileRoute, Outlet} from '@tanstack/react-router'

import {HasSudoProvider} from '#/contexts/has-sudo.tsx'
import {handleVerifyAuth} from '#/server-fns/handle-verify-auth.ts'

export const Route = createFileRoute('/_auth-dynamic')({
	beforeLoad: async () => {
		const auth = await handleVerifyAuth()

		return {auth}
	},
	component: AuthDynamic,
})

function AuthDynamic() {
	const {auth} = Route.useRouteContext()
	return (
		<HasSudoProvider initialSudoExpiresAt={auth?.sudoExpiresAt}>
			<Outlet />
		</HasSudoProvider>
	)
}

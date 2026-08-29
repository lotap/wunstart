import {createFileRoute, redirect, Outlet} from '@tanstack/react-router'

import {handleVerifyAuth} from '#/server-fns/handle-verify-auth.ts'

export const Route = createFileRoute('/_auth-gateway')({
	beforeLoad: async () => {
		const auth = await handleVerifyAuth()
		if (auth) throw redirect({to: '/'})
	},
	component: () => <Outlet />,
})

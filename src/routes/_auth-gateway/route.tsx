/**
 * Auth-flow pages only (sign-in, sign-up). Authed users bounce to `/`.
 * Put a page here if it must NOT render while signed in.
 */
import {createFileRoute, redirect, Outlet} from '@tanstack/react-router'

export const Route = createFileRoute('/_auth-gateway')({
	beforeLoad: async ({context: {auth}}) => {
		if (auth) throw redirect({to: '/'})
	},
	component: () => <Outlet />,
})

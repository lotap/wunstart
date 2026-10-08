/**
 * Pages that require sign-in (e.g. settings). Anons redirect to `/sign-in`
 * with the return location saved. Put a page here if it must NOT render anon.
 * File placement IS the protection: moving a page in or out of this folder
 * changes its guard, so treat moves as security-relevant in review.
 */
import {createFileRoute, redirect, Outlet} from '@tanstack/react-router'

import {HasSudoProvider} from '#/contexts/has-sudo.tsx'

export const Route = createFileRoute('/_auth-protected')({
	beforeLoad: async ({context: {auth}, location}) => {
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

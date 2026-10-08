/**
 * Pages that render for both anon and authed users (e.g. home/dashboard).
 * No redirect in either direction. Put a page here if it adapts to auth state.
 */
import {createFileRoute, Outlet} from '@tanstack/react-router'

import {HasSudoProvider} from '#/contexts/has-sudo.tsx'

export const Route = createFileRoute('/_auth-dynamic')({
	beforeLoad: async ({context: {auth}}) => {
		return {auth}
	},
	component: AuthDynamic,
})

function AuthDynamic() {
	const {auth} = Route.useRouteContext()
	return (
		/**
		 * Keyed by auth presence so the provider resets when the identity appears or
		 * disappears in place (e.g. sign-up navigates back to this same route as an
		 * anon). Without the key the stale initial value from the anon render would
		 * keep hasSudo false
		 */
		<HasSudoProvider key={auth ? 'user' : 'anon'} initialSudoExpiresAt={auth?.sudoExpiresAt}>
			<Outlet />
		</HasSudoProvider>
	)
}

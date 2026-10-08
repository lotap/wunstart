/**
 * Public pages with no auth behavior (e.g. landing-page). Renders for everyone,
 * no guards, no providers. Put a page here if auth state is irrelevant to it.
 */
import {createFileRoute, Outlet} from '@tanstack/react-router'

export const Route = createFileRoute('/_auth-anon')({
	component: () => <Outlet />,
})

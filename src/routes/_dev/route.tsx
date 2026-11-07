import {createFileRoute, notFound, Outlet} from '@tanstack/react-router'

/**
 * Dev-only routes. Production builds exclude this subtree from the generated
 * route tree; the guard remains as defense in depth. Child implementations also
 * stay behind `import.meta.env.DEV` imports.
 */
export const Route = createFileRoute('/_dev')({
	staticData: {audience: 'internal'},
	beforeLoad: () => {
		if (!import.meta.env.DEV) throw notFound()
	},
	component: () => <Outlet />,
})

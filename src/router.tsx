import {createRouter as createTanStackRouter} from '@tanstack/react-router'
import {setupRouterSsrQueryIntegration} from '@tanstack/react-router-ssr-query'

import {RouteError} from './components/global/status-pages/route-error.tsx'
import {getContext} from './integrations/tanstack-query/root-provider.tsx'
import type {AudienceDeclaration} from './lib/resolve-audience.ts'
import {routeTree} from './routeTree.gen.ts'

export function getRouter() {
	const context = getContext()

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		defaultPreload: 'intent',
		defaultPreloadStaleTime: 0,
		defaultViewTransition: true,
		defaultErrorComponent: RouteError,
	})

	setupRouterSsrQueryIntegration({router, queryClient: context.queryClient})

	return router
}

declare module '@tanstack/react-router' {
	interface Register {
		router: ReturnType<typeof getRouter>
	}

	interface HistoryState {
		welcome?: boolean
	}

	interface StaticDataRouteOption {
		/** Which header/footer pairing the route serves; `adaptive` resolves by auth in the root shell. */
		audience?: AudienceDeclaration
	}
}

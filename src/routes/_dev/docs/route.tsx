import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router'

/**
 * Dev-only docs route. The page implementation sits outside the route tree and
 * is imported inside the DEV branch, so production builds tree-shake it away.
 * Production also excludes the `_dev` subtree from the route tree; the parent
 * guard rejects any accidental production match.
 */
const DocsPage = import.meta.env.DEV
	? lazyRouteComponent(() => import('./-components/docs-page.tsx'), 'DocsPage')
	: undefined

export const Route = createFileRoute('/_dev/docs')({
	component: DocsPage,
})

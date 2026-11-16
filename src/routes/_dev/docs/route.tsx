import {createFileRoute} from '@tanstack/react-router'
import {lazy} from 'react'

/**
 * Dev-only docs route. The page implementation sits outside the route tree and
 * is imported inside the DEV branch, so production builds tree-shake it away.
 * Production also excludes the `_dev` subtree from the route tree; the parent
 * guard rejects any accidental production match.
 *
 * React.lazy instead of Router's lazyRouteComponent: the latter triggers React
 * 19's conditional use() warning on client navigation (TanStack/router#8487).
 */
const DocsPage = import.meta.env.DEV
	? lazy(async () => ({default: (await import('./-components/docs-page.tsx')).DocsPage}))
	: undefined

export const Route = createFileRoute('/_dev/docs')({
	component: DocsPage,
})

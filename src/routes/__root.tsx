import {TanStackDevtools} from '@tanstack/react-devtools'
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools'
import type {QueryClient} from '@tanstack/react-query'
import {
	HeadContent,
	Scripts,
	createRootRouteWithContext,
	getRouteApi,
	isNotFound,
	useMatches,
} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'
import {cva} from 'class-variance-authority'

import {appInfo} from '#/app-info.ts'
import {Footer} from '#/components/global/footer/footer.tsx'
import {Header} from '#/components/global/header.tsx'
import {NotFound} from '#/components/global/status-pages/not-found.tsx'
import {RouteError} from '#/components/global/status-pages/route-error.tsx'
import {Toaster} from '#/components/ui/toast.tsx'
import {TooltipProvider} from '#/components/ui/tooltip.tsx'
import {ThemeProvider, useTheme} from '#/contexts/theme.tsx'
import {resolveAudience, type AudienceDeclaration} from '#/lib/resolve-audience.ts'
import {handleVerifyAuth} from '#/server-fns/handle-verify-auth.ts'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.tsx'

import appCss from '../styles.css?url'

interface MyRouterContext {
	queryClient: QueryClient
	/** Client-safe auth state only; db ids are unwrapped server-side from cookies */
	auth?: {
		sudoExpiresAt?: Date
	} | null
}

type NotFoundMatch = {
	status: string
	_notFound?: boolean
	error?: unknown
}

/**
 * The router keeps `status: 'success'` for an unmatched global path and marks it
 * with `_notFound`; route-level not-found errors use `status: 'notFound'`.
 */
function hasNotFound(matches: ReadonlyArray<NotFoundMatch>): boolean {
	return matches.some(
		(match) => match.status === 'notFound' || match._notFound === true || isNotFound(match.error),
	)
}

function hasError(matches: ReadonlyArray<NotFoundMatch>): boolean {
	return matches.some((match) => match.status === 'error')
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async () => {
		const auth = await handleVerifyAuth()

		return {auth}
	},
	head: ({matches}) => {
		const notFound = hasNotFound(matches)
		const error = hasError(matches)

		return {
			meta: [
				{
					charSet: 'utf-8',
				},
				{
					name: 'viewport',
					content: 'width=device-width, initial-scale=1',
				},
				{
					name: 'description',
					content: appInfo.description,
				},
				...(notFound || error ? [{name: 'robots', content: 'noindex'}] : []),
				{
					title: notFound
						? `Page not found | ${appInfo.name}`
						: error
							? `Something went wrong | ${appInfo.name}`
							: appInfo.name,
				},
			],
			links: [
				{
					rel: 'stylesheet',
					href: appCss,
				},
			],
			scripts: [{src: '/theme-init.js'}],
		}
	},
	errorComponent: RouteError,
	notFoundComponent: NotFound,
	shellComponent: App,
})

const rootApi = getRouteApi('__root__')

const documentVariants = cva('h-full', {
	variants: {
		theme: {
			dark: 'dark',
			light: 'light',
		},
	},
})

function RootDocument({children}: {children: React.ReactNode}) {
	const {resolved} = useTheme()
	const {auth} = rootApi.useRouteContext()
	const matches = useMatches()

	const declaredAudience = matches.reduceRight<AudienceDeclaration | undefined>(
		(found, match) => found ?? match.staticData.audience,
		undefined,
	)

	const notFound = hasNotFound(matches)

	const audience = resolveAudience(
		declaredAudience ?? (notFound ? 'adaptive' : undefined),
		Boolean(auth),
	)

	return (
		<html lang="en" suppressHydrationWarning className={documentVariants({theme: resolved})}>
			<head>
				<HeadContent />
			</head>
			<body className="relative flex h-full flex-col text-pretty dark:font-light">
				<TooltipProvider>
					<Header />
					<main className="shrink-0 grow basis-auto">{children}</main>
					<Footer audience={audience} />
					<Toaster />
					<TanStackDevtools
						config={{
							position: 'bottom-right',
						}}
						plugins={[
							{
								name: 'Tanstack Router',
								render: <TanStackRouterDevtoolsPanel />,
							},
							TanStackQueryDevtools,
							formDevtoolsPlugin(),
						]}
					/>
					<Scripts />
				</TooltipProvider>
			</body>
		</html>
	)
}

function App({children}: React.PropsWithChildren) {
	return (
		<ThemeProvider>
			<RootDocument>{children}</RootDocument>
		</ThemeProvider>
	)
}

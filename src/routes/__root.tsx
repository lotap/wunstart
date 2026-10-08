import {TanStackDevtools} from '@tanstack/react-devtools'
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools'
import type {QueryClient} from '@tanstack/react-query'
import {HeadContent, Scripts, createRootRouteWithContext} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'
import {cva} from 'class-variance-authority'

import {Footer} from '#/components/footer.tsx'
import {Header} from '#/components/header.tsx'
import {RouteError} from '#/components/route-error.tsx'
import {Toaster} from '#/components/ui/toast.tsx'
import {TooltipProvider} from '#/components/ui/tooltip.tsx'
import {ThemeProvider, useTheme} from '#/contexts/theme.tsx'
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

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async () => {
		const auth = await handleVerifyAuth()

		return {auth}
	},
	head: () => ({
		meta: [
			{
				charSet: 'utf-8',
			},
			{
				name: 'viewport',
				content: 'width=device-width, initial-scale=1',
			},
			{
				title: 'Wunstart',
			},
		],
		links: [
			{
				rel: 'stylesheet',
				href: appCss,
			},
		],
		scripts: [{src: '/theme-init.js'}],
	}),
	errorComponent: RouteError,
	notFoundComponent: () => (
		<div className="container mx-auto p-4 pt-16">
			<h1>404</h1>
			<p>The requested page could not be found.</p>
		</div>
	),
	shellComponent: App,
})

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
	return (
		<html lang="en" suppressHydrationWarning className={documentVariants({theme: resolved})}>
			<head>
				<HeadContent />
			</head>
			<body className="relative flex h-full flex-col text-pretty">
				<TooltipProvider>
					<Header />
					<main className="shrink-0 grow basis-auto">{children}</main>
					<Footer />
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

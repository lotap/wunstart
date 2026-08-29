import {TanStackDevtools} from '@tanstack/react-devtools'
import {formDevtoolsPlugin} from '@tanstack/react-form-devtools'
import type {QueryClient} from '@tanstack/react-query'
import {HeadContent, Scripts, createRootRouteWithContext} from '@tanstack/react-router'
import {TanStackRouterDevtoolsPanel} from '@tanstack/react-router-devtools'
import {cva} from 'class-variance-authority'

import {Footer} from '#/components/footer.tsx'
import {Header} from '#/components/header.tsx'
import {Toaster} from '#/components/ui/sonner.tsx'
import {TooltipProvider} from '#/components/ui/tooltip.tsx'
import {ThemeProvider, useTheme} from '#/contexts/theme.tsx'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools.tsx'

import appCss from '../styles.css?url'

interface MyRouterContext {
	queryClient: QueryClient
	auth?: {
		userId: string
	} | null
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
	errorComponent: () => (
		<main className="container mx-auto p-4 pt-16">
			<h1>Uh-oh</h1>
			<p>Something broke. Try again later.</p>
		</main>
	),
	notFoundComponent: () => (
		<main className="container mx-auto p-4 pt-16">
			<h1>404</h1>
			<p>The requested page could not be found.</p>
		</main>
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
					<Toaster position="top-center" />
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

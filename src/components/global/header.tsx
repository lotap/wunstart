import {Link, getRouteApi} from '@tanstack/react-router'

import {appInfo} from '#/app-info.ts'

import {RouterButton} from './router-button.tsx'
import ThemeToggle from './theme-toggle.tsx'
import {UserNav} from './user-nav.tsx'

const rootApi = getRouteApi('__root__')

export function Header() {
	const {auth} = rootApi.useRouteContext()

	return (
		<header className="relative z-30 border-b bg-background">
			<nav className="mx-auto flex max-w-5xl flex-row items-center justify-between px-2">
				<h1 className="font-heading text-2xl font-bold dark:font-semibold">
					<Link to="/">{appInfo.name}</Link>
				</h1>
				<ul className="flex gap-4">
					<li className="hidden sm:block">
						<Link to="/landing-page">Landing Page</Link>
					</li>
					{import.meta.env.DEV && (
						<li>
							<Link to="/docs">Docs</Link>
						</li>
					)}
				</ul>
				<div className="flex items-center gap-1">
					<ThemeToggle />
					{auth ? (
						<UserNav />
					) : (
						<>
							<RouterButton
								to="/sign-in"
								variant="ghost"
								className="font-semibold dark:font-medium"
							>
								Sign In
							</RouterButton>
							<RouterButton
								to="/sign-up"
								variant="default"
								className="font-semibold dark:font-medium"
							>
								Sign Up
							</RouterButton>
						</>
					)}
				</div>
			</nav>
		</header>
	)
}

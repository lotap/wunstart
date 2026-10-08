import {Link, getRouteApi} from '@tanstack/react-router'

import {RouterButton} from './router-button.tsx'
import ThemeToggle from './theme-toggle.tsx'
import {UserNav} from './user-nav.tsx'

const rootApi = getRouteApi('__root__')

export function Header() {
	const {auth} = rootApi.useRouteContext()

	return (
		<header className="border-b">
			<nav className="flex flex-row items-center justify-between">
				<h1 className="ml-3 font-heading text-2xl font-bold dark:font-semibold">
					<Link to="/">Wunstart</Link>
				</h1>
				<ul className="flex gap-4">
					<li>
						<Link to="/landing-page">Landing Page</Link>
					</li>
				</ul>
				<div className="flex items-center gap-1">
					{auth ? (
						<UserNav />
					) : (
						<>
							<RouterButton to="/sign-in" variant="ghost">
								Sign In
							</RouterButton>
							<RouterButton to="/sign-up" variant="default">
								Sign Up
							</RouterButton>
						</>
					)}
					<ThemeToggle />
				</div>
			</nav>
		</header>
	)
}

import {Link} from '@tanstack/react-router'

import ThemeToggle from './theme-toggle.tsx'

export function Header() {
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
					<li>
						<Link to="/settings">Settings</Link>
					</li>
				</ul>
				<ThemeToggle />
			</nav>
		</header>
	)
}

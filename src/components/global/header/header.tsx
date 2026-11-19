import {Link, getRouteApi} from '@tanstack/react-router'
import {Menu} from 'lucide-react'
import {useEffect, useState} from 'react'

import {appInfo} from '#/app-info.ts'
import {Button} from '#/components/ui/button.tsx'
import {Drawer, DrawerTrigger} from '#/components/ui/drawer.tsx'
import {PUBLIC_REPO_URL} from '#/repo.ts'

import {RouterButton} from '../router-button.tsx'
import ThemeToggle from '../theme-toggle.tsx'
import {Wordmark} from '../wordmark.tsx'
import {GitHubIconLink} from './_github-link.tsx'
import {ANON_LINKS, USER_LINKS} from './_links.ts'
import {HeaderDrawer} from './_nav-drawer.tsx'
import {NavLink} from './_nav-link.tsx'
import {UserNav} from './_user-nav.tsx'

const rootApi = getRouteApi('__root__')

export function Header() {
	const {auth} = rootApi.useRouteContext()
	const [menuOpen, setMenuOpen] = useState(false)

	const links = auth ? USER_LINKS : ANON_LINKS
	const repoHref = auth ? null : PUBLIC_REPO_URL

	// The trigger is hidden at `md`; close a drawer left open across the resize.
	useEffect(() => {
		const query = window.matchMedia('(width >= 48rem)')

		const onChange = () => {
			if (query.matches) setMenuOpen(false)
		}

		query.addEventListener('change', onChange)

		return () => query.removeEventListener('change', onChange)
	}, [])

	const closeMenu = () => setMenuOpen(false)

	return (
		<header className="relative z-30 border-b bg-background">
			<div className="px-2">
				<nav
					aria-label="Main"
					className="relative mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-stretch gap-1 sm:h-16 sm:gap-6 md:h-18 md:gap-12"
				>
					<div className="flex items-center">
						<Link
							to="/"
							aria-label={`${appInfo.name} home`}
							onClick={closeMenu}
							className="-m-1 inline-flex rounded-sm p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						>
							<Wordmark className="h-5 w-auto sm:h-6" />
						</Link>
					</div>
					<ul className="hidden h-full items-center gap-6 justify-self-start md:flex">
						{links.map((link) => (
							<li key={link.to} className="h-full">
								<NavLink link={link} className="h-full" />
							</li>
						))}
					</ul>
					<div className="col-start-3 flex items-center gap-1 justify-self-end md:gap-2">
						{repoHref && <GitHubIconLink href={repoHref} />}
						<div className="max-md:hidden">
							<ThemeToggle className="size-10" />
						</div>
						<span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-border md:block" />
						{auth ? (
							<div className="max-md:hidden">
								<UserNav />
							</div>
						) : (
							<>
								<RouterButton
									to="/sign-in"
									variant="ghost"
									size="lg"
									className="hidden h-10 px-4 text-sm text-muted-foreground md:inline-flex dark:font-normal"
								>
									Sign in
								</RouterButton>
								<RouterButton
									to="/sign-up"
									size="lg"
									onClick={closeMenu}
									className="h-10 px-5 max-md:hidden dark:font-normal"
								>
									Sign up
								</RouterButton>
							</>
						)}
						<Drawer open={menuOpen} onOpenChange={setMenuOpen} swipeDirection="right">
							<DrawerTrigger
								render={
									<Button
										variant="ghost"
										size="icon-lg"
										className="size-11 hover:bg-transparent aria-expanded:bg-transparent md:hidden dark:hover:bg-transparent"
										aria-label="Open site menu"
									/>
								}
							>
								<Menu />
							</DrawerTrigger>
							<HeaderDrawer
								open={menuOpen}
								links={links}
								repoHref={repoHref}
								signedIn={auth !== null}
								onNavigate={closeMenu}
							/>
						</Drawer>
					</div>
				</nav>
			</div>
		</header>
	)
}

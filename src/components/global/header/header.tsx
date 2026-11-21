import {Link, getRouteApi} from '@tanstack/react-router'
import {Menu} from 'lucide-react'
import {useRef, useState} from 'react'

import {appInfo} from '#/app-info.ts'
import {Button} from '#/components/ui/button.tsx'
import {Drawer, DrawerTrigger} from '#/components/ui/drawer.tsx'
import {PUBLIC_REPO_URL} from '#/repo.ts'

import {RouterButton} from '../router-button.tsx'
import ThemeToggle from '../theme-toggle.tsx'
import {Wordmark} from '../wordmark.tsx'
import {GitHubIconLink} from './_github-link.tsx'
import {ANON_LINKS, SIGN_IN_LINK, SIGN_UP_LINK, USER_LINKS} from './_links.ts'
import {HeaderDrawer} from './_nav-drawer.tsx'
import {NavLink} from './_nav-link.tsx'
import {useBarPin} from './_use-bar-pin.ts'
import {UserNav} from './_user-nav.tsx'

const rootApi = getRouteApi('__root__')

export function Header() {
	const {auth} = rootApi.useRouteContext()
	const [menuOpen, setMenuOpen] = useState(false)
	const barRef = useRef<HTMLDivElement>(null)
	const slotRef = useRef<HTMLElement>(null)

	useBarPin({barRef, slotRef})

	const links = auth ? USER_LINKS : ANON_LINKS
	const repoHref = auth ? null : PUBLIC_REPO_URL

	const closeMenu = () => setMenuOpen(false)

	return (
		<header ref={slotRef} className="relative h-14 shrink-0 sm:h-16 md:h-18">
			{/* The in-flow slot reserves the bar’s height while the bar is out of flow. */}
			<div
				ref={barRef}
				data-header-bar
				className="absolute inset-x-0 top-0 z-40 h-14 border-b bg-background data-dismiss:animate-out data-dismiss:duration-150 data-dismiss:ease-out data-dismiss:fill-mode-forwards data-dismiss:slide-out-to-top data-reveal:animate-in data-reveal:duration-150 data-reveal:ease-out data-reveal:slide-in-from-top sm:h-16 md:h-18"
			>
				<div className="h-full px-2">
					<nav
						aria-label="Main"
						className="relative mx-auto grid h-full max-w-5xl grid-cols-[auto_1fr_auto] items-stretch gap-1 sm:gap-6 md:gap-12"
					>
						<div className="flex items-center">
							<Link
								to="/"
								aria-label={`${appInfo.name} home`}
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
							<ThemeToggle className="size-10 max-md:hidden" />
							<span aria-hidden="true" className="mx-2 hidden h-6 w-px bg-border md:block" />
							{auth ? (
								<div className="max-md:hidden">
									<UserNav />
								</div>
							) : (
								<>
									<RouterButton
										to={SIGN_IN_LINK.to}
										variant="ghost"
										size="lg"
										className="hidden h-10 px-4 text-sm text-muted-foreground md:inline-flex dark:font-normal"
									>
										{SIGN_IN_LINK.label}
									</RouterButton>
									<RouterButton
										to={SIGN_UP_LINK.to}
										size="lg"
										className="h-10 px-5 max-md:hidden dark:font-normal"
									>
										{SIGN_UP_LINK.label}
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
									<Menu aria-hidden="true" />
								</DrawerTrigger>
								<HeaderDrawer
									links={links}
									repoHref={repoHref}
									signedIn={auth !== null}
									onNavigate={closeMenu}
								/>
							</Drawer>
						</div>
					</nav>
				</div>
			</div>
		</header>
	)
}

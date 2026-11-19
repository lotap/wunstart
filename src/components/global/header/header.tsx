import {Link, getRouteApi} from '@tanstack/react-router'
import {Menu, X} from 'lucide-react'
import {useRef, useState} from 'react'

import {appInfo} from '#/app-info.ts'
import {Button} from '#/components/ui/button.tsx'
import {useDismissibleMenu} from '#/hooks/use-dismissible-menu.ts'
import {useSheetLock} from '#/hooks/use-sheet-lock.ts'
import {PUBLIC_REPO_URL} from '#/repo.ts'

import {RouterButton} from '../router-button.tsx'
import ThemeToggle from '../theme-toggle.tsx'
import {Wordmark} from '../wordmark.tsx'
import {GitHubIconLink} from './_github-link.tsx'
import {HeaderMenu} from './_header-menu.tsx'
import {ANON_LINKS, USER_LINKS} from './_links.ts'
import {NavLink} from './_nav-link.tsx'
import {UserNav} from './_user-nav.tsx'

const rootApi = getRouteApi('__root__')

const MENU_ID = 'site-menu'

export function Header() {
	const {auth} = rootApi.useRouteContext()
	const [menuOpen, setMenuOpen] = useState(false)
	const navRef = useRef<HTMLElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)

	const links = auth ? USER_LINKS : ANON_LINKS
	const repoHref = auth ? null : PUBLIC_REPO_URL

	useDismissibleMenu({
		open: menuOpen,
		setOpen: setMenuOpen,
		containerRef: navRef,
		triggerRef,
	})
	useSheetLock(menuOpen)

	const closeMenu = () => setMenuOpen(false)

	return (
		<header className="relative z-30 border-b bg-background">
			<div className="px-2">
				<nav
					ref={navRef}
					aria-label="Main"
					className="relative mx-auto grid h-14 max-w-5xl grid-cols-[auto_1fr_auto] items-stretch gap-1 sm:h-16 sm:gap-6"
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
					<ul className="hidden h-full items-center gap-5 justify-self-center md:flex">
						{links.map((link) => (
							<li key={link.to} className="h-full">
								<NavLink link={link} className="h-full" />
							</li>
						))}
					</ul>
					<div className="col-start-3 flex items-center gap-1 justify-self-end">
						{repoHref && <GitHubIconLink href={repoHref} />}
						<div className="max-md:hidden">
							<ThemeToggle />
						</div>
						<span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-border md:block" />
						{auth ? (
							<UserNav />
						) : (
							<>
								<RouterButton
									to="/sign-in"
									variant="ghost"
									size="lg"
									className="hidden px-3 text-sm text-muted-foreground md:inline-flex dark:font-normal"
								>
									Sign in
								</RouterButton>
								<RouterButton
									to="/sign-up"
									size="lg"
									onClick={closeMenu}
									className="px-4 max-md:hidden dark:font-normal"
								>
									Sign up
								</RouterButton>
							</>
						)}
						<Button
							ref={triggerRef}
							type="button"
							variant="ghost"
							size="icon-lg"
							className="size-11 hover:bg-transparent aria-expanded:bg-transparent md:hidden"
							aria-label={menuOpen ? 'Close site menu' : 'Open site menu'}
							aria-expanded={menuOpen}
							aria-controls={MENU_ID}
							onClick={() => setMenuOpen((open) => !open)}
						>
							{menuOpen ? <X /> : <Menu />}
						</Button>
					</div>
					<HeaderMenu
						id={MENU_ID}
						open={menuOpen}
						links={links}
						repoHref={repoHref}
						showAuth={!auth}
						onNavigate={closeMenu}
					/>
				</nav>
			</div>
		</header>
	)
}

import {cn} from 'cn'
import {X} from 'lucide-react'

import {Button} from '#/components/ui/button.tsx'
import {DrawerClose, DrawerContent, DrawerTitle} from '#/components/ui/drawer.tsx'

import {RouterButton} from '../router-button.tsx'
import ThemeToggle from '../theme-toggle.tsx'
import {AccountLinks, AccountSignOut} from './_account.tsx'
import {GitHubMenuRow} from './_github-link.tsx'
import {SIGN_IN_LINK, SIGN_UP_LINK, type HeaderLink} from './_links.ts'
import {NavLink} from './_nav-link.tsx'

/**
 * The site menu where the bar collapses, as a right-hand drawer over a dimmed
 * page. The drawer header mirrors the bar height so the close control lands
 * where the trigger was; the middle scrolls, and the auth pair stays anchored.
 */
export function HeaderDrawer({
	links,
	repoHref,
	signedIn,
	onNavigate,
}: {
	links: readonly HeaderLink[]
	repoHref: string | null
	signedIn: boolean
	onNavigate: () => void
}) {
	return (
		<DrawerContent>
			<DrawerTitle className="sr-only">Site menu</DrawerTitle>
			<div className="flex h-14 shrink-0 items-center justify-end px-4 sm:h-16">
				<DrawerClose
					render={
						<Button
							variant="ghost"
							size="icon-lg"
							aria-label="Close site menu"
							className="size-11 hover:bg-transparent dark:hover:bg-transparent"
						/>
					}
				>
					<X aria-hidden="true" />
				</DrawerClose>
			</div>
			<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6">
				<div className="my-auto w-full">
					<ul>
						{links.map((link) => (
							<li key={link.to}>
								<NavLink
									link={link}
									onNavigate={onNavigate}
									className="-mx-2 h-13 rounded-lg px-2 text-3xl"
								/>
							</li>
						))}
					</ul>
					<div className="mt-16 flex flex-col">
						{!signedIn && repoHref && <GitHubMenuRow href={repoHref} onNavigate={onNavigate} />}
						{signedIn && <AccountLinks onNavigate={onNavigate} />}
						<ThemeToggle
							label="Theme"
							className={cn(
								'-mx-2 h-11 justify-start border-0 px-2 text-base hover:bg-transparent dark:hover:bg-transparent',
								signedIn && 'mt-6',
							)}
						/>
					</div>
				</div>
			</div>
			<div className="shrink-0 px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
				{signedIn ? (
					<AccountSignOut onNavigate={onNavigate} />
				) : (
					<div className="flex flex-col gap-3">
						<RouterButton
							to={SIGN_IN_LINK.to}
							variant="ghost"
							size="lg"
							onClick={onNavigate}
							className="h-14 w-full px-2 text-base text-muted-foreground dark:font-normal"
						>
							{SIGN_IN_LINK.label}
						</RouterButton>
						<RouterButton
							to={SIGN_UP_LINK.to}
							size="lg"
							onClick={onNavigate}
							className="h-14 w-full px-2 text-base dark:font-normal"
						>
							{SIGN_UP_LINK.label}
						</RouterButton>
					</div>
				)}
			</div>
		</DrawerContent>
	)
}

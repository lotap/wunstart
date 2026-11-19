import {cn} from 'cn'

import {RouterButton} from '../router-button.tsx'
import ThemeToggle from '../theme-toggle.tsx'
import {AccountLinks, AccountSignOut} from './_account.tsx'
import {GitHubMenuRow} from './_github-link.tsx'
import {SIGN_IN_LINK, type HeaderLink} from './_links.ts'
import {NavLink} from './_nav-link.tsx'

export function HeaderMenu({
	id,
	open,
	links,
	repoHref,
	signedIn,
	onNavigate,
}: {
	id: string
	open: boolean
	links: readonly HeaderLink[]
	repoHref: string | null
	signedIn: boolean
	onNavigate: () => void
}) {
	return (
		<div
			id={id}
			className={cn(
				// `100%` is the nav height, so the sheet always ends at the viewport edge
				// without duplicating the header’s height.
				'absolute top-full -right-2 -left-2 z-40 flex h-[calc(100dvh-100%)] flex-col overflow-hidden bg-background p-6 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden',
				open ? 'flex' : 'hidden',
			)}
		>
			{/* The scroller spans the sheet so its 24px pad owns the gutter; the
			    content column does the centering, and rows may inset 8px into the pad. */}
			<div className="-mx-6 flex min-h-0 w-auto flex-1 flex-col overflow-y-auto overscroll-contain px-6">
				<div className="mx-auto my-auto w-full max-w-md">
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
						{signedIn ? (
							<>
								<AccountLinks open={open} onNavigate={onNavigate} />
								<ThemeToggle
									label="Theme"
									className="-mx-2 mt-6 h-11 justify-start border-0 px-2 text-base hover:bg-transparent"
								/>
							</>
						) : (
							<>
								{repoHref && <GitHubMenuRow href={repoHref} onNavigate={onNavigate} />}
								<ThemeToggle
									label="Theme"
									className="-mx-2 h-11 justify-start border-0 px-2 text-base hover:bg-transparent"
								/>
							</>
						)}
					</div>
				</div>
			</div>
			{signedIn ? (
				<div className="mx-auto w-full max-w-md shrink-0">
					<AccountSignOut onNavigate={onNavigate} />
				</div>
			) : (
				<div className="mx-auto flex w-full max-w-md shrink-0 flex-col gap-3">
					<RouterButton
						to={SIGN_IN_LINK.to}
						variant="ghost"
						size="lg"
						onClick={onNavigate}
						className="h-14 w-full justify-center rounded-lg px-2 text-base text-muted-foreground dark:font-normal"
					>
						{SIGN_IN_LINK.label}
					</RouterButton>
					<RouterButton
						to="/sign-up"
						size="lg"
						onClick={onNavigate}
						className="h-14 w-full justify-center rounded-lg px-2 text-base dark:font-normal"
					>
						Sign up
					</RouterButton>
				</div>
			)}
		</div>
	)
}

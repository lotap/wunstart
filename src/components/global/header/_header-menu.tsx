import {cn} from 'cn'

import {GitHubMenuRow} from './_github-link.tsx'
import {SIGN_IN_LINK, type HeaderLink} from './_links.ts'
import {NavLink} from './_nav-link.tsx'

export function HeaderMenu({
	id,
	open,
	links,
	repoHref,
	showSignIn,
	hideFromSm,
	onNavigate,
}: {
	id: string
	open: boolean
	links: readonly HeaderLink[]
	repoHref: string | null
	showSignIn: boolean
	hideFromSm?: boolean
	onNavigate: () => void
}) {
	return (
		<div
			id={id}
			className={cn(
				'absolute inset-x-0 top-full z-40 mt-1 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-background p-1 shadow-md ring-1 ring-foreground/10 sm:left-auto sm:w-80 lg:hidden',
				hideFromSm && 'sm:hidden',
				open ? 'block' : 'hidden',
			)}
		>
			<ul>
				{links.map((link) => (
					<li key={link.to}>
						<NavLink
							link={link}
							onNavigate={onNavigate}
							className="h-11 w-full rounded-lg px-3 hover:bg-muted"
						/>
					</li>
				))}
			</ul>
			{links.length > 0 && (repoHref !== null || showSignIn) && (
				<div className={cn('my-1 h-px bg-border', repoHref === null && 'sm:hidden')} />
			)}
			{repoHref && <GitHubMenuRow href={repoHref} onNavigate={onNavigate} />}
			{repoHref && showSignIn && <div className="my-1 h-px bg-border sm:hidden" />}
			{showSignIn && (
				<NavLink
					link={SIGN_IN_LINK}
					onNavigate={onNavigate}
					className="h-11 w-full rounded-lg px-3 hover:bg-muted sm:hidden"
				/>
			)}
		</div>
	)
}

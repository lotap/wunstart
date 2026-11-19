import {Link} from '@tanstack/react-router'
import {cn} from 'cn'

import type {HeaderLink} from './_links.ts'

/**
 * Header link voice. Change this one component to restyle both the desktop list
 * and the links panel; swap `text-sm` for `font-mono text-xs tracking-[0.12em] uppercase`
 * to get the mono-caps variant.
 */
export function NavLink({
	link,
	className,
	onNavigate,
}: {
	link: HeaderLink
	className?: string
	onNavigate?: () => void
}) {
	return (
		<Link
			to={link.to}
			onClick={onNavigate}
			className={cn(
				'group flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset data-[status=active]:text-foreground motion-reduce:transition-none dark:font-normal',
				className,
			)}
		>
			<span className="relative after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-foreground after:opacity-0 after:transition-opacity after:content-[''] group-data-[status=active]:after:opacity-100 motion-reduce:transition-none">
				{link.label}
			</span>
		</Link>
	)
}

import {SiGithub} from '@icons-pack/react-simple-icons'
import {cn} from 'cn'
import {ArrowUpRight} from 'lucide-react'

import {buttonVariants} from '#/components/ui/button.tsx'
import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'

/** Desktop action: the project’s repository in the signed-out utility cluster. */
export function GitHubIconLink({href}: {href: string}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<a
						href={href}
						target="_blank"
						rel="noreferrer"
						aria-label="GitHub"
						className={cn(
							buttonVariants({variant: 'ghost', size: 'icon-lg'}),
							'size-10 max-md:hidden',
						)}
					>
						<SiGithub aria-hidden="true" className="size-4" />
					</a>
				}
			/>
			<TooltipContent>GitHub</TooltipContent>
		</Tooltip>
	)
}

/** Drawer row: the word plus an external-link mark in the secondary group. */
export function GitHubMenuRow({href, onNavigate}: {href: string; onNavigate: () => void}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			onClick={onNavigate}
			className="-mx-2 flex h-11 items-center gap-2 rounded-lg px-2 text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset dark:font-normal"
		>
			GitHub
			<ArrowUpRight aria-hidden="true" className="size-4" />
		</a>
	)
}

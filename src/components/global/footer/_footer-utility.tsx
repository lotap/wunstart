import {cn} from 'cn'
import {ArrowUp} from 'lucide-react'

import {appInfo} from '#/app-info.ts'
import ThemeToggle from '#/components/global/theme-toggle.tsx'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

const year = new Date().getFullYear()

const utilityLinkClassName =
	'underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-current/50 focus-visible:outline-none'

export function FooterUtility({className}: {className?: string}) {
	const reduceMotion = useReducedMotion()

	return (
		<div
			className={cn(
				'flex flex-col gap-3 border-t border-current/20 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between',
				className,
			)}
		>
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
				<small suppressHydrationWarning>
					© {year} {appInfo.name}
				</small>
				{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid react-doctor/anchor-is-valid */}
				<a href="#" className={utilityLinkClassName}>
					Privacy policy
				</a>
				{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid react-doctor/anchor-is-valid */}
				<a href="#" className={utilityLinkClassName}>
					Terms of service
				</a>
				<a
					href="https://github.com/lotap/wunstart/blob/trunk/LICENSE"
					target="_blank"
					rel="noreferrer"
					className={utilityLinkClassName}
				>
					MIT License
				</a>
			</div>
			<div className="flex items-center gap-2">
				<ThemeToggle size="icon-sm" />
				<button
					type="button"
					onClick={() => window.scrollTo({top: 0, behavior: reduceMotion ? 'auto' : 'smooth'})}
					className="inline-flex items-center gap-1.5 underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-current/50 focus-visible:outline-none"
				>
					Back to top
					<ArrowUp aria-hidden="true" className="size-3.5" />
				</button>
			</div>
		</div>
	)
}

import {Link} from '@tanstack/react-router'
import {ArrowUpRight} from 'lucide-react'

import {appInfo} from '#/app-info.ts'

import {FooterUtility} from './_footer-utility.tsx'

export function InternalFooter() {
	return (
		<footer className="relative bg-background font-normal">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 text-muted-foreground">
				<div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
					<Link
						to="/"
						aria-label={`${appInfo.name} home`}
						className="text-3xl font-bold tracking-tight text-foreground"
					>
						{appInfo.name}
					</Link>

					<nav
						aria-label="Footer"
						className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:justify-end"
					>
						<Link to="/" className="transition-colors hover:text-foreground">
							Dashboard
						</Link>
						{import.meta.env.DEV && (
							<Link to="/docs" className="transition-colors hover:text-foreground">
								Docs
							</Link>
						)}
						<a
							href="https://github.com/lotap/wunstart"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
						>
							GitHub
							<ArrowUpRight aria-hidden="true" className="size-3.5" />
						</a>
					</nav>
				</div>

				<FooterUtility />
			</div>
		</footer>
	)
}

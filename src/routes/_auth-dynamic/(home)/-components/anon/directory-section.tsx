import {Link} from '@tanstack/react-router'

import {SlashGrid} from './slash-grid.tsx'

type ActiveRoute = {
	path: '/' | '/landing-page' | '/sign-in' | '/sign-up' | '/settings' | '/docs'
	access: string
	file: string
	description: string
	warning?: string
}

const activeRoutes: Array<ActiveRoute> = [
	{
		path: '/',
		access: 'Anon + user',
		file: 'src/routes/_auth-dynamic/(home)/index.tsx',
		description: 'Home for anonymous visitors. Signed-in users see the dashboard.',
	},
	{
		path: '/landing-page',
		access: 'Public',
		file: 'src/routes/_auth-anon/landing-page/route.tsx',
		description: 'Marketing page with the product intro and next-step sections.',
	},
	{
		path: '/sign-in',
		access: 'Anon only',
		file: 'src/routes/_auth-gateway/sign-in.tsx',
		description: 'Sign-in form. Signed-in visitors redirect to /.',
	},
	{
		path: '/sign-up',
		access: 'Anon only',
		file: 'src/routes/_auth-gateway/sign-up.tsx',
		description: 'Sign-up form with email verification.',
	},
	{
		path: '/settings',
		access: 'Signed in',
		file: 'src/routes/_auth-protected/settings/route.tsx',
		description: 'Profile, preferences, sessions, and account security.',
	},
	{
		path: '/docs',
		access: 'Dev only',
		file: 'src/routes/_dev/docs/route.tsx',
		description: 'In-repo developer reference.',
		warning: 'Returns 404 in production.',
	},
]

export function DirectorySection() {
	return (
		<section aria-labelledby="directory-title" className="w-full max-w-5xl">
			<SlashGrid />
			<h2 id="directory-title" className="px-6 py-3 font-heading text-3xl">
				Directory
			</h2>
			<SlashGrid />
			<div className="flex pt-6">
				<div className="flex w-5/6 flex-col gap-5 px-6 pt-3 pb-6 sm:w-3/4 md:w-2/3 lg:w-7/12">
					<p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
						Each page is yours to update, delete, or otherwise modify to your app’s needs.
					</p>
					<ul className="flex flex-col gap-5">
						{activeRoutes.map((route) => (
							<li
								key={route.path}
								className="grid gap-1 sm:grid-cols-[8rem_6.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
							>
								<Link
									to={route.path}
									className="font-mono text-sm text-foreground underline hover:text-foreground/70"
								>
									{route.path}
								</Link>
								<span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
									{route.access}
								</span>
								<div className="flex min-w-0 flex-col gap-1">
									<p className="text-sm leading-relaxed">
										{route.description}{' '}
										{route.warning && <span className="text-destructive">{route.warning}</span>}
									</p>
									<p className="font-mono text-xs leading-relaxed text-muted-foreground">
										{route.file}
									</p>
								</div>
							</li>
						))}
					</ul>
				</div>

				{/* // GUTTER */}
				<SlashGrid className="w-1/6 grid-cols-10 sm:hidden" contentLength={10 * 37} />
				<SlashGrid
					className="hidden w-1/4 grid-cols-15 sm:grid md:hidden"
					contentLength={15 * 35}
				/>
				<SlashGrid
					className="hidden w-1/3 grid-cols-20 md:grid lg:hidden"
					contentLength={20 * 26}
				/>
				<SlashGrid className="hidden w-5/12 grid-cols-25 lg:grid" contentLength={25 * 32} />
			</div>
			<SlashGrid contentLength={60 * 2} />
		</section>
	)
}

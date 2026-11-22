import {Link, createFileRoute} from '@tanstack/react-router'

const entries = [
	{
		title: 'Error preview',
		description: 'Renders the route error component with a sample error.',
		path: '/status-pages/error',
	},
	{
		title: 'Throw a route error',
		description: 'Triggers the real error boundary and 500 response.',
		path: '/status-pages/throw',
	},
] as const

export const Route = createFileRoute('/_dev/status-pages/')({
	head: () => ({
		meta: [{title: 'Status pages | wunstart'}, {name: 'robots', content: 'noindex'}],
	}),
	component: StatusPages,
})

function StatusPages() {
	return (
		<section className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24">
			<p className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
				Dev only
			</p>

			<h1 className="mt-4 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
				Status pages
			</h1>

			<p className="mt-3 max-w-md text-muted-foreground">
				Preview the route-level error states and open a real 404. These routes are excluded from
				production builds.
			</p>

			<ul className="mt-10 divide-y divide-border border-y border-border">
				<li>
					{/*
					 * Unmatched path: Link has no route to resolve, and only a full
					 * document request gets the server’s 404 response
					 */}
					<a
						href="/does-not-exist"
						className="flex flex-col gap-1 py-5 transition-colors hover:text-foreground sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
					>
						<span className="flex flex-col gap-1">
							<span className="text-sm font-medium">Real 404</span>
							<span className="text-sm text-muted-foreground">
								Unmatched URL with an actual 404 response.
							</span>
						</span>
						<span className="font-mono text-xs text-muted-foreground">/does-not-exist</span>
					</a>
				</li>
				{entries.map((entry) => (
					<li key={entry.path}>
						<Link
							to={entry.path}
							className="flex flex-col gap-1 py-5 transition-colors hover:text-foreground sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
						>
							<span className="flex flex-col gap-1">
								<span className="text-sm font-medium">{entry.title}</span>
								<span className="text-sm text-muted-foreground">{entry.description}</span>
							</span>
							<span className="font-mono text-xs text-muted-foreground">{entry.path}</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

import {PanelLink, PanelReferences} from '../../doc-links.tsx'
import {PanelHeader} from '../../doc-ui.tsx'

type FlowLayer = {
	name: string
	where: string
	job: React.ReactNode
}

type FlowStep = FlowLayer & {
	children?: Array<FlowLayer>
}

const flowGroups = [
	{
		label: 'Front end',
		description:
			'The route is the front-end entry point. React, shadcn/ui, and Tailwind are the layers it renders through.',
		layers: [
			{
				name: 'Route',
				where: 'src/routes',
				job: (
					<>
						The URL selects a route group and page. The page is built from React, shadcn/ui, and
						Tailwind, reads through TanStack Query, and calls a server function. See{' '}
						<PanelLink panel="route-guards">Route guards</PanelLink> for the access rules.
					</>
				),
				children: [
					{
						name: 'React',
						where: 'src/routes · src/components',
						job: 'Renders the page on the server and in the browser. React Compiler is on, so components do not hand-memoize.',
					},
					{
						name: 'shadcn/ui',
						where: 'src/components/ui',
						job: 'The page composes generated Base UI primitives for buttons, fields, drawers, and navigation.',
					},
					{
						name: 'Tailwind',
						where: 'src/styles.css',
						job: 'Theme tokens and utilities style the primitives. cn() composes classes and keeps spacing, color, and radius on one scale.',
					},
				],
			},
		],
	},
	{
		label: 'Back end',
		description:
			'The server boundary resolves identity, runs the op, and reaches Postgres through the model.',
		layers: [
			{
				name: 'Server function',
				where: 'src/server-fns',
				job: (
					<>
						Validates input, unwraps identity from the context, and calls one op through runOp. See{' '}
						<PanelLink group="guide" panel="start-a-new-page">
							Start a new page
						</PanelLink>{' '}
						for the full shape.
					</>
				),
			},
			{
				name: 'Middleware',
				where: 'src/start.ts · src/middleware',
				job: (
					<>
						Applies CSRF, verifies identity, and enforces rate limits before the handler runs. See{' '}
						<PanelLink panel="middleware">Middleware & identity</PanelLink>.
					</>
				),
			},
			{
				name: 'Op',
				where: 'src/db/ops',
				job: 'Runs the business logic in Effect and logs an Activity for the attempt.',
			},
			{
				name: 'Model',
				where: 'src/db/models/<domain>',
				job: (
					<>
						The data layer for one domain. Tables, validations, and queries live in separate files.
						See{' '}
						<PanelLink group="guide" panel="database-migrations">
							Database migrations
						</PanelLink>{' '}
						for schema changes.
					</>
				),
				children: [
					{
						name: 'Tables',
						where: 'schemas.ts',
						job: 'Active and archive twins built through the table factories. Deletes move rows, never hard-delete audit data.',
					},
					{
						name: 'Validations',
						where: 'validations.ts',
						job: 'Effect Schema shapes for inserts, selects, and statement input.',
					},
					{
						name: 'Queries',
						where: 'queries.ts',
						job: 'Prepared Drizzle queries. Cross-domain joins live in --- directories.',
					},
				],
			},
			{
				name: 'Postgres',
				where: 'Docker · Hyperdrive',
				job: 'Stores live rows and their archive twins.',
			},
		],
	},
] satisfies Array<{label: string; description: string; layers: Array<FlowStep>}>

export function RequestFlowPanel() {
	return (
		<>
			<PanelHeader
				title="Request flow"
				description="How the screen hands a request to the server and where it lands in Postgres."
			/>

			<div className="mt-8 flex flex-col gap-5">
				{flowGroups.map((group, groupIndex) => {
					const headingId = `flow-group-${groupIndex}`

					return (
						<section
							key={group.label}
							aria-labelledby={headingId}
							className="overflow-hidden rounded-xl border bg-muted/20"
						>
							<header className="flex flex-col gap-1 bg-muted/30 px-5 py-4">
								<h5 id={headingId} className="text-base font-medium">
									{group.label}
								</h5>
								<p className="text-sm text-muted-foreground">{group.description}</p>
							</header>

							<ol>
								{group.layers.map((layer, index) => (
									<li key={layer.name} className="border-t first:border-t-0">
										<div className="grid gap-1 px-5 py-4 sm:grid-cols-[2rem_14rem_1fr] sm:items-baseline sm:gap-4">
											<span className="font-mono text-xs text-muted-foreground">
												{String(index + 1).padStart(2, '0')}
											</span>
											<div className="flex flex-col gap-0.5">
												<span className="text-sm font-medium">{layer.name}</span>
												<code className="font-mono text-xs text-muted-foreground">
													{layer.where}
												</code>
											</div>
											<p className="text-sm leading-relaxed text-muted-foreground">{layer.job}</p>
										</div>

										{layer.children && (
											<ol className="ml-5 border-l border-border/70 pl-4 sm:ml-13 sm:pl-5">
												{layer.children.map((child) => (
													<li
														key={child.name}
														className="grid gap-1 border-t border-border/70 py-3 sm:grid-cols-[13rem_1fr] sm:gap-3"
													>
														<div className="flex flex-col gap-0.5">
															<span className="text-sm font-medium">{child.name}</span>
															<code className="font-mono text-xs text-muted-foreground">
																{child.where}
															</code>
														</div>
														<p className="text-sm leading-relaxed text-muted-foreground">
															{child.job}
														</p>
													</li>
												))}
											</ol>
										)}
									</li>
								))}
							</ol>
						</section>
					)
				})}
			</div>

			<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
				Server functions are the only client-to-server boundary. Ops are the only place business
				logic meets the database.
			</p>

			<PanelReferences
				links={[
					{label: 'React', href: 'https://react.dev/'},
					{label: 'shadcn/ui', href: 'https://ui.shadcn.com/'},
					{label: 'Tailwind CSS', href: 'https://tailwindcss.com/'},
					{
						label: 'TanStack Start',
						href: 'https://tanstack.com/start/latest/docs/framework/react/overview',
					},
					{
						label: 'TanStack Query',
						href: 'https://tanstack.com/query/latest/docs/framework/react/overview',
					},
					{label: 'Effect', href: 'https://effect.website/docs'},
					{label: 'Drizzle ORM', href: 'https://orm.drizzle.team/docs/overview'},
					{label: 'PostgreSQL', href: 'https://www.postgresql.org/docs/'},
				]}
			/>
		</>
	)
}

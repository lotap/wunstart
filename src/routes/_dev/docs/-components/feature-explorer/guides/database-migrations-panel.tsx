import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader} from '../../doc-ui.tsx'

const steps = [
	{
		id: 'edit',
		description: (
			<>
				Edit the module in <InlineCode>src/db/models/&lt;domain&gt;/</InlineCode>. Every active
				table keeps an archive twin.
			</>
		),
	},
	{
		id: 'generate',
		description: (
			<>
				Run <InlineCode>bun run db:generate</InlineCode> to write SQL into{' '}
				<InlineCode>src/db/migrations/</InlineCode>.
			</>
		),
	},
	{
		id: 'apply',
		description: (
			<>
				Review the migration, then apply it with <InlineCode>bun run db:migrate</InlineCode>.
			</>
		),
	},
	{
		id: 'check',
		description: (
			<>
				Run <InlineCode>bun run db:check</InlineCode> before committing. Use{' '}
				<InlineCode>bun run db:studio</InlineCode> to inspect rows.
			</>
		),
	},
]

export function DatabaseMigrationsPanel() {
	return (
		<>
			<PanelHeader
				title="Database migrations"
				description="Schema changes go through generated migrations. The active table and its archive twin change together."
			/>

			<div className="mt-8 grid gap-5 rounded-xl border bg-muted/20 p-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
				<ol className="flex flex-col gap-4">
					{steps.map((step, index) => (
						<li key={step.id} className="flex gap-3">
							<span className="font-mono text-xs text-muted-foreground">
								{String(index + 1).padStart(2, '0')}
							</span>
							<p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
						</li>
					))}
				</ol>

				<div className="flex flex-col gap-2 border-t pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-5">
					<p className="text-sm font-medium">Rules</p>
					<ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/50">
						<li>Commit the generated migration with the model change.</li>
						<li>Review generated SQL before applying it.</li>
						<li>
							<InlineCode>branch-env</InlineCode> applies migrations when it provisions a branch
							database.
						</li>
					</ul>
				</div>
			</div>

			<PanelReferences
				links={[
					{
						label: 'Drizzle Kit migrations',
						href: 'https://orm.drizzle.team/docs/migrations',
					},
				]}
			/>
		</>
	)
}

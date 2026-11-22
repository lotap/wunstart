import {ArrowUpRight, ChevronDown} from 'lucide-react'

import {mailpitUrl} from '../../-utils/local-services.ts'
import {DocDiagram} from '../doc-diagram.tsx'
import {PanelHeader} from '../doc-ui.tsx'

export type FeatureAction = {
	label: string
	description: string
	href: string
}

export type FeatureFlow = {
	key: string
	name: string
	routes: string[]
	serverFunctions: string[]
	ops: string[]
	models: string[]
	charts: Array<{label?: string; source: string}>
	notes?: string[]
	mailpit?: boolean
}

function CodeChip({children}: {children: React.ReactNode}) {
	return (
		<code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm text-muted-foreground">
			{children}
		</code>
	)
}

function FlowMeta({label, values}: {label: string; values: string[]}) {
	return (
		<div className="grid gap-1 sm:grid-cols-[7rem_1fr] sm:items-baseline">
			<dt className="text-sm text-muted-foreground">{label}</dt>
			<dd className="flex flex-wrap items-center gap-1">
				{values.map((value) => (
					<CodeChip key={value}>{value}</CodeChip>
				))}
			</dd>
		</div>
	)
}

function FlowNotes({flow}: {flow: FeatureFlow}) {
	return (
		<>
			{flow.notes?.map((note) => (
				<p key={note} className="mt-3 text-base leading-relaxed text-muted-foreground">
					{note}
				</p>
			))}

			{flow.mailpit && mailpitUrl && (
				<a
					href={mailpitUrl}
					target="_blank"
					rel="noreferrer"
					className="mt-3 inline-flex w-fit items-center gap-1 text-base text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
				>
					Open Mailpit <ArrowUpRight aria-hidden="true" className="size-4" />
				</a>
			)}
		</>
	)
}

function Flow({flow, idPrefix}: {flow: FeatureFlow; idPrefix: string}) {
	const meta = [
		{label: 'Routes', values: flow.routes},
		{label: 'Server functions', values: flow.serverFunctions},
		{label: 'Ops', values: flow.ops},
		{label: 'Models', values: flow.models},
	].filter((entry) => entry.values.length > 0)

	return (
		<li className="border-t py-6 first:border-t-0 first:pt-0">
			<p className="text-lg font-medium">{flow.name}</p>

			<FlowNotes flow={flow} />

			{meta.length > 0 && (
				<dl className="mt-4 flex flex-col gap-2">
					{meta.map((entry) => (
						<FlowMeta key={entry.label} label={entry.label} values={entry.values} />
					))}
				</dl>
			)}

			{flow.charts.length > 0 && (
				<details className="group mt-5">
					<summary className="-ml-2.5 inline-flex h-8 w-fit shrink-0 cursor-pointer list-none items-center justify-center gap-1 rounded-md px-2.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&::-webkit-details-marker]:hidden">
						<span className="group-open:hidden">View detailed flow</span>
						<span className="hidden group-open:inline">Hide detailed flow</span>
						<ChevronDown
							aria-hidden="true"
							className="size-3.5 transition-transform duration-200 group-open:rotate-180"
						/>
					</summary>

					<div className="mt-4 flex flex-col gap-5">
						{flow.charts.map((chart, index) => {
							const label = chart.label ? `${flow.name} · ${chart.label}` : flow.name

							return (
								<div key={chart.label ?? chart.source} className="flex flex-col gap-2">
									{chart.label && (
										<p className="text-sm font-medium text-muted-foreground">{chart.label}</p>
									)}
									<DocDiagram
										source={chart.source}
										label={label}
										idPrefix={`${idPrefix}-${flow.key}-${index}`}
									/>
								</div>
							)
						})}
					</div>
				</details>
			)}
		</li>
	)
}

/** Opt-in structured flow list for feature and reference panels. */
export function FeatureFlows({flows, idPrefix}: {flows: FeatureFlow[]; idPrefix: string}) {
	return (
		<div className="rounded-xl border p-5 sm:p-6">
			<ol className="flex flex-col">
				{flows.map((flow) => (
					<Flow key={flow.key} flow={flow} idPrefix={idPrefix} />
				))}
			</ol>
		</div>
	)
}

/** Opt-in list of working product paths. */
export function FeatureActions({actions}: {actions: FeatureAction[]}) {
	return (
		<ul className="flex flex-col divide-y">
			{actions.map((action) => (
				<li key={action.href}>
					{/* Actions open in a new tab so the docs page keeps its selected panel. */}
					<a
						href={action.href}
						target="_blank"
						rel="noreferrer"
						className="group flex items-start justify-between gap-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<span className="flex min-w-0 flex-col">
							<span className="text-base font-medium group-hover:underline">{action.label}</span>
							<span className="text-base text-muted-foreground">{action.description}</span>
						</span>
						<ArrowUpRight
							aria-hidden="true"
							className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
						/>
					</a>
				</li>
			))}
		</ul>
	)
}

/** Shared frame for feature tabs. Features own their children. */
export function FeatureShell({
	title,
	summary,
	children,
}: {
	title: string
	summary: string
	children: React.ReactNode
}) {
	return (
		<>
			<PanelHeader title={title} description={summary} />
			{children}
		</>
	)
}

/** Shared frame for catalog entries that are not built yet. */
export function PlannedFeatureShell({
	title,
	summary,
	placeholder,
}: {
	title: string
	summary: string
	placeholder: string
}) {
	return (
		<>
			<PanelHeader title={title} description={summary} />
			<p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
				Coming soon. {placeholder}
			</p>
		</>
	)
}

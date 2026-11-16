import {ArrowUpRight, ChevronDown} from 'lucide-react'

import {mailpitUrl} from '../../../-content/local-development.ts'
import type {
	AvailableFeature,
	Feature,
	FeatureAction,
	FeatureFlow,
	PlannedFeature,
} from '../../../-content/types.ts'
import {PromptBlock} from '../../code-block.tsx'
import {DocDiagram} from '../../doc-diagram.tsx'
import {PanelLink, PanelReferences} from '../../doc-links.tsx'
import {PanelHeader, PanelSection, Prose} from '../../doc-ui.tsx'

function CodeChip({children}: {children: React.ReactNode}) {
	return (
		<code className="rounded-sm bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
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
				<p key={note} className="mt-2 text-sm leading-relaxed text-muted-foreground">
					{note}
				</p>
			))}

			{flow.mailpit && mailpitUrl && (
				<a
					href={mailpitUrl}
					target="_blank"
					rel="noreferrer"
					className="mt-2 inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
				>
					Open Mailpit <ArrowUpRight className="size-3.5" />
				</a>
			)}
		</>
	)
}

function Flow({flow}: {flow: FeatureFlow}) {
	const meta = [
		{label: 'Routes', values: flow.routes},
		{label: 'Server functions', values: flow.serverFunctions},
		{label: 'Ops', values: flow.ops},
		{label: 'Models', values: flow.models},
	].filter((entry) => entry.values.length > 0)

	return (
		<li className="border-t py-5 first:border-t-0 first:pt-0">
			<p className="text-base font-medium">{flow.name}</p>

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
					<summary className="-ml-2.5 inline-flex h-7 w-fit shrink-0 cursor-pointer list-none items-center justify-center gap-1 rounded-md px-2.5 text-[0.8rem] font-medium whitespace-nowrap text-muted-foreground transition-all outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&::-webkit-details-marker]:hidden">
						<span className="group-open:hidden">View detailed flow</span>
						<span className="hidden group-open:inline">Hide detailed flow</span>
						<ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180" />
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
										idPrefix={`auth-${flow.key}-${index}`}
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

function FeatureFlows({flows}: {flows: FeatureFlow[]}) {
	return (
		<section className="mt-8 rounded-xl border p-4 sm:p-5">
			<ol className="flex flex-col">
				{flows.map((flow) => (
					<Flow key={flow.key} flow={flow} />
				))}
			</ol>
		</section>
	)
}

function FeatureActions({actions}: {actions: FeatureAction[]}) {
	return (
		<section aria-label="Available now" className="mt-6">
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
								<span className="text-sm text-muted-foreground">{action.description}</span>
							</span>
							<ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
						</a>
					</li>
				))}
			</ul>
		</section>
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

/** Transitional adapter for data-driven feature entries. */
function DataFeaturePanel({feature}: {feature: AvailableFeature}) {
	return (
		<FeatureShell title={feature.name} summary={feature.summary}>
			{feature.intro && (
				<PanelSection id={`${feature.key}-intro`} title={feature.intro.title}>
					<Prose>{feature.intro.body}</Prose>
				</PanelSection>
			)}
			{feature.actions.length > 0 && <FeatureActions actions={feature.actions} />}
			{feature.flows.length > 0 && <FeatureFlows flows={feature.flows} />}
			{feature.panelLink && (
				<p className="mt-4 text-sm">
					<PanelLink panel={feature.panelLink.panel}>{feature.panelLink.label}</PanelLink>
				</p>
			)}
			<PanelSection
				id={`${feature.key}-extend`}
				title={`Extend ${feature.name.toLowerCase()}`}
				className="border-t pt-6"
			>
				<PromptBlock title={`${feature.name} prompt`} prompt={feature.prompt} />
				{feature.notes?.map((note) => (
					<Prose key={note}>{note}</Prose>
				))}
			</PanelSection>
			{feature.references && feature.references.length > 0 && (
				<PanelReferences links={feature.references} />
			)}
		</FeatureShell>
	)
}

function PlannedFeaturePanel({feature}: {feature: PlannedFeature}) {
	return (
		<>
			<PanelHeader title={feature.name} description={feature.summary} />
			<p className="mt-6 max-w-2xl text-sm text-muted-foreground">
				Coming soon. {feature.placeholder}
			</p>
		</>
	)
}

export function FeaturePanel({feature}: {feature: Feature}) {
	if (feature.status === 'planned') {
		return <PlannedFeaturePanel feature={feature} />
	}

	if ('Panel' in feature) {
		const Panel = feature.Panel

		return <Panel />
	}

	return <DataFeaturePanel feature={feature} />
}

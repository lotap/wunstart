import {ArrowUpRight, ChevronDown} from 'lucide-react'
import {register, render} from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'

import {mailpitUrl} from '../../-content/local-development.ts'
import type {AvailableFeature, Feature, FeatureFlow, PlannedFeature} from '../../-content/types.ts'
import {PromptBlock} from '../code-block.tsx'
import {PanelReferences} from '../doc-links.tsx'
import {PanelHeader} from '../doc-ui.tsx'

register(flowchart)

const flowChartConfig = `%%{init: {"flowchart": {"nodeSpacing": 12, "rankSpacing": 12}}}%%\n`

function CodeChip({children}: {children: React.ReactNode}) {
	return (
		<code className="rounded-sm bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
			{children}
		</code>
	)
}

function FlowDiagram({svg, label}: {svg: string; label: string}) {
	return (
		<div
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable diagram needs keyboard focus
			tabIndex={0}
			aria-label={`${label} flow diagram`}
			className="scrollbar-thin overflow-x-auto pb-1 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			<div
				suppressHydrationWarning
				className="mx-auto w-max min-w-full md:flex md:w-full md:justify-center [&_svg]:h-auto [&_svg]:max-h-none [&_svg]:w-auto [&_svg]:max-w-none md:[&_svg]:max-w-full"
				// Static Mermaid source rendered by Pele. No user input.
				dangerouslySetInnerHTML={{__html: svg}}
			/>
		</div>
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

function Flow({flow}: {flow: FeatureFlow}) {
	return (
		<li className="border-t py-5 first:border-t-0 first:pt-0">
			<p className="text-base font-medium">{flow.name}</p>

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

			<dl className="mt-4 flex flex-col gap-2">
				<FlowMeta label="Routes" values={flow.routes} />
				<FlowMeta label="Server functions" values={flow.serverFunctions} />
				<FlowMeta label="Ops" values={flow.ops} />
				<FlowMeta label="Models" values={flow.models} />
			</dl>

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
								<FlowDiagram
									svg={
										render(`${flowChartConfig}${chart.source}`, {
											idPrefix: `auth-${flow.key}-${index}`,
											fontSize: 22,
										}).svg
									}
									label={label}
								/>
							</div>
						)
					})}
				</div>
			</details>
		</li>
	)
}

function FeatureFlows({feature}: {feature: AvailableFeature}) {
	return (
		<section className="mt-8 rounded-xl border p-4 sm:p-5">
			<ol className="flex flex-col">
				{feature.flows.map((flow) => (
					<Flow key={flow.key} flow={flow} />
				))}
			</ol>
		</section>
	)
}

function FeatureActions({feature}: {feature: AvailableFeature}) {
	const headingId = `${feature.key}-available`

	return (
		<section aria-labelledby={headingId} className="mt-6">
			<h5 id={headingId} className="sr-only">
				Available now
			</h5>

			<ul className="flex flex-col divide-y">
				{feature.actions.map((action) => (
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

function AvailableFeaturePanel({feature}: {feature: AvailableFeature}) {
	return (
		<>
			<PanelHeader title={feature.name} description={feature.summary} />
			{feature.actions.length > 0 && <FeatureActions feature={feature} />}
			{feature.flows.length > 0 && <FeatureFlows feature={feature} />}

			<section className="mt-8 border-t pt-6">
				<p className="text-base font-medium">Extend {feature.name.toLowerCase()}</p>
				<div className="mt-4">
					<PromptBlock title={`${feature.name} prompt`} prompt={feature.prompt} />
				</div>
				{feature.notes?.map((note) => (
					<p key={note} className="mt-5 text-sm leading-relaxed text-muted-foreground">
						{note}
					</p>
				))}
			</section>

			{feature.references && feature.references.length > 0 && (
				<PanelReferences links={feature.references} />
			)}
		</>
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

	return <AvailableFeaturePanel feature={feature} />
}

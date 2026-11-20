import {useRouter} from '@tanstack/react-router'
import {cn} from 'cn'
import {ArrowDown} from 'lucide-react'
import type {ComponentType} from 'react'
import {useEffect, useRef} from 'react'

import {PanelNavigationProvider} from '../doc-links.tsx'
import {MicroLabel} from '../doc-ui.tsx'
import {AbuseProtectionFeature} from './features/abuse-protection-feature.tsx'
import {AuthFeature} from './features/auth-feature.tsx'
import {ImageOptimizationFeature} from './features/image-optimization-feature.tsx'
import {
	AgenticIntegrationsFeature,
	AnalyticsFeature,
	FeatureFlagsFeature,
	FileUploadFeature,
	PaymentProcessingFeature,
	RbacFeature,
} from './features/planned-features.tsx'
import {DatabaseMigrationsPanel} from './guides/database-migrations-panel.tsx'
import {HeaderPanel} from './guides/header-panel.tsx'
import {PageRecipePanel} from './guides/page-recipe-panel.tsx'
import {WorktreesPanel} from './guides/worktrees-panel.tsx'
import {AbusePanel} from './reference/abuse-panel.tsx'
import {AgentsOverviewPanel} from './reference/agents-overview-panel.tsx'
import {AuthPanel} from './reference/auth-panel.tsx'
import {ConfigurationPanel} from './reference/configuration-panel.tsx'
import {MiddlewarePanel} from './reference/middleware-panel.tsx'
import {ReactEmailPanel} from './reference/react-email-panel.tsx'
import {RequestFlowPanel} from './reference/request-flow-panel.tsx'
import {RouteGuardsPanel} from './reference/route-guards-panel.tsx'
import {RuntimePanel} from './reference/runtime-panel.tsx'
import {StaticImagesPanel} from './reference/static-images-panel.tsx'
import {StatusPagesPanel} from './reference/status-pages-panel.tsx'

// Alphabetical by label; keep sorted.
const referencePanels = [
	{key: 'agents-overview', label: 'Agents overview', Panel: AgentsOverviewPanel},
	{key: 'auth', label: 'Auth', Panel: AuthPanel},
	{key: 'configuration', label: 'Configuration', Panel: ConfigurationPanel},
	{key: 'middleware', label: 'Middleware & identity', Panel: MiddlewarePanel},
	{key: 'abuse', label: 'Rate limits & bans', Panel: AbusePanel},
	{key: 'react-email', label: 'React Email', Panel: ReactEmailPanel},
	{key: 'request-flow', label: 'Request flow', Panel: RequestFlowPanel},
	{key: 'route-guards', label: 'Route guards', Panel: RouteGuardsPanel},
	{key: 'runtime', label: 'Runtime & hashing', Panel: RuntimePanel},
	{key: 'static-images', label: 'Static images', Panel: StaticImagesPanel},
	{key: 'status-pages', label: 'Status pages', Panel: StatusPagesPanel},
] as const

// Task order, not alphabetical: the order a new project meets them.
const guidePanels = [
	{key: 'start-a-new-page', label: 'Start a new page', Panel: PageRecipePanel},
	{key: 'customize-header', label: 'Customize the header', Panel: HeaderPanel},
	{key: 'worktrees', label: 'Worktrees', Panel: WorktreesPanel},
	{key: 'database-migrations', label: 'Database migrations', Panel: DatabaseMigrationsPanel},
] as const

// Alphabetical by label; keep sorted.
const featurePanels = [
	{key: 'abuse', label: 'Abuse protection', Panel: AbuseProtectionFeature},
	{key: 'agents', label: 'Agentic integrations', Panel: AgenticIntegrationsFeature, planned: true},
	{key: 'analytics', label: 'Analytics', Panel: AnalyticsFeature, planned: true},
	{key: 'auth', label: 'Auth', Panel: AuthFeature},
	{key: 'flags', label: 'Feature flags', Panel: FeatureFlagsFeature, planned: true},
	{key: 'files', label: 'File upload', Panel: FileUploadFeature, planned: true},
	{key: 'images', label: 'Image optimization', Panel: ImageOptimizationFeature},
	{key: 'payments', label: 'Payment processing', Panel: PaymentProcessingFeature, planned: true},
	{key: 'rbac', label: 'RBAC', Panel: RbacFeature, planned: true},
] as const

export type ReferencePanelKey = (typeof referencePanels)[number]['key']

export type GuidePanelKey = (typeof guidePanels)[number]['key']

type FeaturePanelKey = (typeof featurePanels)[number]['key']

export type SidePanelKey = ReferencePanelKey | GuidePanelKey

/** A guide or reference panel; the group disambiguates keys that repeat. */
export type PanelTarget =
	| {group: 'guide'; key: GuidePanelKey}
	| {group: 'reference'; key: ReferencePanelKey}

type PanelSelection = PanelTarget | {group: 'feature'; key: FeaturePanelKey}

const defaultSelection: PanelSelection = {group: 'guide', key: guidePanels[0].key}

/**
 * Resolves `?panel=<group>.<key>`. The group travels in the value because keys
 * repeat across surfaces (`auth` is both a feature and a reference); unknown
 * values fall back to the first guide.
 */
function resolveSelection(value: string | undefined): PanelSelection {
	if (value === undefined) return defaultSelection

	const [group, key, ...rest] = value.split('.')

	if (key === undefined || rest.length > 0) return defaultSelection

	if (group === 'guide') {
		const panel = guidePanels.find((candidate) => candidate.key === key)

		if (panel) return {group, key: panel.key}
	}

	if (group === 'reference') {
		const panel = referencePanels.find((candidate) => candidate.key === key)

		if (panel) return {group, key: panel.key}
	}

	if (group === 'feature') {
		const panel = featurePanels.find((candidate) => candidate.key === key)

		if (panel) return {group, key: panel.key}
	}

	return defaultSelection
}

function scrollToSection(id: string) {
	document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'})
}

/**
 * Scroll the explorer to the top edge. An upward scroll pins the site bar, so
 * the target reserves the bar’s height before it appears.
 */
function scrollToExplorer(section: HTMLElement, behavior: ScrollBehavior) {
	const scrollY = window.scrollY
	const inset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
	const sectionTop = section.getBoundingClientRect().top + scrollY - inset
	const bar = document.querySelector<HTMLElement>('[data-header-bar]')
	const barHeight = bar?.offsetHeight ?? 0
	const pinned = bar ? getComputedStyle(bar).position === 'fixed' : false
	let target = sectionTop - (pinned ? barHeight : 0)

	if (target > scrollY && pinned) {
		// A downward scroll releases the bar, so the section can use the edge.
		target = sectionTop
	} else if (target < scrollY && !pinned) {
		// The upward scroll pins the bar before smooth scrolling reaches the target.
		target = sectionTop - barHeight
	}

	window.scrollTo({top: Math.max(target, 0), behavior})
}

/**
 * The docs page owns its scroll because `/docs` opts out of router scroll
 * restoration. On arrival, a hash or panel is a deep link; otherwise reset the
 * offset a client navigation kept from the previous page.
 */
function scrollToDocsTarget(section: HTMLElement | null, behavior: ScrollBehavior) {
	const hash = window.location.hash.slice(1)
	const hashTarget = hash ? document.getElementById(hash) : null

	if (hashTarget) {
		hashTarget.scrollIntoView({behavior, block: 'start'})

		return
	}

	if (section && new URLSearchParams(window.location.search).has('panel')) {
		scrollToExplorer(section, behavior)

		return
	}

	window.scrollTo({top: 0, behavior})
}

function SectionJump({label, target}: {label: string; target: string}) {
	return (
		<button
			type="button"
			onClick={() => scrollToSection(target)}
			className="flex w-auto items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full md:justify-between md:px-3"
		>
			{label}
			<ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
		</button>
	)
}

function SidebarTab({
	active,
	tabbable = false,
	label,
	ariaLabel,
	id,
	controls,
	onClick,
}: {
	active: boolean
	tabbable?: boolean
	label: string
	ariaLabel?: string
	id: string
	controls: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			role="tab"
			id={id}
			aria-label={ariaLabel}
			aria-selected={active}
			aria-controls={controls}
			tabIndex={active || tabbable ? 0 : -1}
			onClick={onClick}
			className={cn(
				'rounded-md px-2.5 py-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:w-full md:px-3 md:text-left',
				active
					? 'bg-foreground text-background'
					: 'text-muted-foreground hover:bg-muted hover:text-foreground',
			)}
		>
			{label}
		</button>
	)
}

function SectionGroupLabel({children}: {children: React.ReactNode}) {
	return <MicroLabel className="px-2.5 text-foreground md:px-3">{children}</MicroLabel>
}

function handleTabKeyDown(
	event: React.KeyboardEvent<HTMLDivElement>,
	onSelect: (index: number) => void,
) {
	if (
		event.key !== 'ArrowRight' &&
		event.key !== 'ArrowLeft' &&
		event.key !== 'ArrowDown' &&
		event.key !== 'ArrowUp' &&
		event.key !== 'Home' &&
		event.key !== 'End'
	) {
		return
	}

	event.preventDefault()

	const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
	const current = tabs.findIndex((tab) => tab === document.activeElement)

	if (current === -1) return

	let next = current

	if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
		next = (current + 1) % tabs.length
	}

	if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
		next = (current - 1 + tabs.length) % tabs.length
	}

	if (event.key === 'Home') next = 0

	if (event.key === 'End') next = tabs.length - 1

	tabs[next]?.focus()
	onSelect(next)
}

function SidePanelGroup({
	group,
	label,
	panels,
	activeKey,
	onSelect,
	className,
}: {
	group: string
	label: string
	panels: ReadonlyArray<{key: string; label: string}>
	activeKey: SidePanelKey | null
	onSelect: (index: number) => void
	className?: string
}) {
	const activeIndex = Math.max(
		panels.findIndex((panel) => panel.key === activeKey),
		0,
	)

	return (
		<div className={className}>
			<SectionGroupLabel>{label}</SectionGroupLabel>
			<div
				role="tablist"
				aria-label={label}
				tabIndex={-1}
				onKeyDown={(event) => handleTabKeyDown(event, onSelect)}
				className="mt-1.5 flex flex-wrap gap-1 md:flex-col"
			>
				{panels.map((panel, index) => (
					<SidebarTab
						key={panel.key}
						active={activeKey === panel.key}
						tabbable={index === activeIndex}
						label={panel.label}
						id={`${group}-tab-${panel.key}`}
						controls={`${group}-panel-${panel.key}`}
						onClick={() => onSelect(index)}
					/>
				))}
			</div>
		</div>
	)
}

function PanelTabPanel({
	group,
	panel,
	active,
}: {
	group: string
	panel: {key: string; Panel: ComponentType}
	active: boolean
}) {
	const Panel = panel.Panel

	return (
		<div
			role="tabpanel"
			id={`${group}-panel-${panel.key}`}
			aria-labelledby={`${group}-tab-${panel.key}`}
			hidden={!active}
			className="mt-6 min-h-[calc(100svh-2rem)] rounded-xl border bg-muted/20 p-5 md:mt-0 md:p-8"
		>
			{active && <Panel />}
		</div>
	)
}

export function FeatureExplorer({panel}: {panel?: string}) {
	const router = useRouter()
	const selection = resolveSelection(panel)
	const activeGuide = selection.group === 'guide' ? selection.key : null
	const activeReference = selection.group === 'reference' ? selection.key : null

	const activeFeature =
		selection.group === 'feature'
			? featurePanels.findIndex((feature) => feature.key === selection.key)
			: -1

	const tabbableFeature = activeFeature === -1 ? 0 : activeFeature

	const sectionRef = useRef<HTMLElement>(null)
	const selectionKey = `${selection.group}.${selection.key}`
	const previousSelection = useRef(selectionKey)

	useEffect(() => {
		scrollToDocsTarget(sectionRef.current, 'instant')
	}, [])

	// Scroll after the panel commit, not in the click handler: swapping panel
	// content cancels an in-flight smooth scroll.
	useEffect(() => {
		if (previousSelection.current === selectionKey) return

		previousSelection.current = selectionKey

		const behavior: ScrollBehavior = new URLSearchParams(window.location.search).has('panel')
			? 'smooth'
			: 'instant'

		scrollToDocsTarget(sectionRef.current, behavior)
	}, [selectionKey])

	function selectPanel(group: PanelSelection['group'], key: string) {
		void router.navigate({
			to: '/docs',
			search: (prev) => ({...prev, panel: `${group}.${key}`}),
			replace: true,
			// A tab switch should not cross-fade the whole page; the transition also
			// delays the commit that the scroll effect waits for.
			viewTransition: false,
			// Selection is an in-page switch; the effect above owns the scroll.
			resetScroll: false,
		})
	}

	function selectFeature(index: number) {
		const feature = featurePanels[index]

		if (!feature) return

		selectPanel('feature', feature.key)
	}

	function selectReferencePanel(index: number) {
		const selected = referencePanels[index]

		if (!selected) return

		selectPanel('reference', selected.key)
	}

	function selectGuidePanel(index: number) {
		const selected = guidePanels[index]

		if (!selected) return

		selectPanel('guide', selected.key)
	}

	function selectPanelTarget(target: PanelTarget) {
		selectPanel(target.group, target.key)
	}

	return (
		<PanelNavigationProvider onSelect={selectPanelTarget}>
			<section ref={sectionRef} className="w-full max-w-5xl">
				<div className="flex flex-col md:flex-row md:items-start md:gap-6">
					<div
						className="font-mono text-xs md:sticky md:w-60 md:shrink-0 md:pt-4 md:transition-[top] md:duration-(--header-dock-transition,0ms) md:ease-out"
						style={{top: 'calc(1rem + var(--header-dock, 0px))'}}
					>
						<SidePanelGroup
							group="guide"
							label="Guides"
							panels={guidePanels}
							activeKey={activeGuide}
							onSelect={selectGuidePanel}
						/>

						<div className="mt-5">
							<SectionGroupLabel>Features</SectionGroupLabel>
							<div
								role="tablist"
								aria-label="Features"
								tabIndex={-1}
								onKeyDown={(event) => handleTabKeyDown(event, selectFeature)}
								className="mt-1.5 flex flex-wrap gap-1 border-b pb-2 md:flex-col md:flex-nowrap md:border-b-0 md:pb-0"
							>
								{featurePanels.map((feature, index) => (
									<SidebarTab
										key={feature.key}
										active={index === activeFeature}
										tabbable={index === tabbableFeature}
										label={feature.label}
										ariaLabel={
											'planned' in feature ? `${feature.label}, coming soon` : feature.label
										}
										id={`feature-tab-${feature.key}`}
										controls={`feature-panel-${feature.key}`}
										onClick={() => selectFeature(index)}
									/>
								))}
							</div>
						</div>

						<SidePanelGroup
							group="reference"
							label="Reference"
							panels={referencePanels}
							activeKey={activeReference}
							onSelect={selectReferencePanel}
							className="mt-5"
						/>

						<nav aria-label="Stack" className="mt-5 flex flex-col gap-1">
							<SectionGroupLabel>Stack</SectionGroupLabel>
							<div className="flex flex-row flex-wrap gap-1 md:flex-col">
								<SectionJump label="Architectural overview" target="architectural-overview" />
							</div>
						</nav>
					</div>

					<div className="min-w-0 flex-1">
						{referencePanels.map((entry) => (
							<PanelTabPanel
								key={entry.key}
								group="reference"
								panel={entry}
								active={activeReference === entry.key}
							/>
						))}

						{guidePanels.map((entry) => (
							<PanelTabPanel
								key={entry.key}
								group="guide"
								panel={entry}
								active={activeGuide === entry.key}
							/>
						))}

						{featurePanels.map((feature, index) => (
							<PanelTabPanel
								key={feature.key}
								group="feature"
								panel={feature}
								active={index === activeFeature}
							/>
						))}
					</div>
				</div>
			</section>
		</PanelNavigationProvider>
	)
}

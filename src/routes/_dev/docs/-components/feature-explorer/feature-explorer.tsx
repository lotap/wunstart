import {cn} from 'cn'
import {ArrowDown} from 'lucide-react'
import type {ComponentType} from 'react'
import {useRef, useState} from 'react'

import {features} from '../../-content/features.ts'
import {PanelNavigationProvider} from '../doc-links.tsx'
import {MicroLabel} from '../doc-ui.tsx'
import {FeaturePanel} from './features/feature-panel.tsx'
import {PageRecipePanel} from './guides/page-recipe-panel.tsx'
import {AgentsOverviewPanel} from './reference/agents-overview-panel.tsx'
import {ConfigurationPanel} from './reference/configuration-panel.tsx'
import {DatabaseMigrationsPanel} from './reference/database-migrations-panel.tsx'
import {MiddlewarePanel} from './reference/middleware-panel.tsx'
import {ReactEmailPanel} from './reference/react-email-panel.tsx'
import {RequestFlowPanel} from './reference/request-flow-panel.tsx'
import {RouteGuardsPanel} from './reference/route-guards-panel.tsx'
import {RuntimePanel} from './reference/runtime-panel.tsx'
import {StaticImagesPanel} from './reference/static-images-panel.tsx'
import {StatusPagesPanel} from './reference/status-pages-panel.tsx'
import {WorktreesPanel} from './reference/worktrees-panel.tsx'

const referencePanels = [
	{key: 'configuration', label: 'Configuration', Panel: ConfigurationPanel},
	{key: 'request-flow', label: 'Request flow', Panel: RequestFlowPanel},
	{key: 'route-guards', label: 'Route guards', Panel: RouteGuardsPanel},
	{key: 'status-pages', label: 'Status pages', Panel: StatusPagesPanel},
	{key: 'database-migrations', label: 'Database migrations', Panel: DatabaseMigrationsPanel},
	{key: 'middleware', label: 'Middleware & identity', Panel: MiddlewarePanel},
	{key: 'react-email', label: 'React Email', Panel: ReactEmailPanel},
	{key: 'runtime', label: 'Runtime & hashing', Panel: RuntimePanel},
	{key: 'static-images', label: 'Static images', Panel: StaticImagesPanel},
	{key: 'agents-overview', label: 'Agents overview', Panel: AgentsOverviewPanel},
	{key: 'worktrees', label: 'Worktrees', Panel: WorktreesPanel},
] as const

const guidePanels = [
	{key: 'start-a-new-page', label: 'Start a new page', Panel: PageRecipePanel},
] as const

type ReferencePanelKey = (typeof referencePanels)[number]['key']

type GuidePanelKey = (typeof guidePanels)[number]['key']

export type SidePanelKey = ReferencePanelKey | GuidePanelKey

const defaultSidePanel: SidePanelKey = guidePanels[0].key

function tabId(key: string) {
	return `feature-tab-${key}`
}

function panelId(key: string) {
	return `feature-panel-${key}`
}

function scrollToSection(id: string) {
	document.getElementById(id)?.scrollIntoView({behavior: 'smooth', block: 'start'})
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
	return <MicroLabel className="px-2.5 md:px-3">{children}</MicroLabel>
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
			className="mt-6 min-h-[calc(100svh-2rem)] rounded-xl border bg-muted/20 p-4 md:mt-0 md:p-6"
		>
			{active && <Panel />}
		</div>
	)
}

export function FeatureExplorer() {
	const [active, setActive] = useState(0)
	const [sidePanel, setSidePanel] = useState<SidePanelKey | null>(defaultSidePanel)
	const sectionRef = useRef<HTMLElement>(null)

	if (features.length === 0) return null

	function selectFeature(index: number) {
		setSidePanel(null)
		setActive(index)
		sectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})
	}

	function selectReferencePanel(index: number) {
		const panel = referencePanels[index]

		if (!panel) return

		setSidePanel(panel.key)
		sectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})
	}

	function selectGuidePanel(index: number) {
		const panel = guidePanels[index]

		if (!panel) return

		setSidePanel(panel.key)
		sectionRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})
	}

	function selectPanelByKey(key: SidePanelKey) {
		const referenceIndex = referencePanels.findIndex((panel) => panel.key === key)

		if (referenceIndex !== -1) {
			selectReferencePanel(referenceIndex)

			return
		}

		const guideIndex = guidePanels.findIndex((panel) => panel.key === key)

		if (guideIndex !== -1) selectGuidePanel(guideIndex)
	}

	return (
		<PanelNavigationProvider onSelect={selectPanelByKey}>
			<section ref={sectionRef} className="w-full max-w-5xl">
				<div className="flex flex-col md:flex-row md:items-start md:gap-6">
					<div className="font-mono text-xs md:sticky md:top-4 md:w-60 md:shrink-0 md:pt-4">
						<SidePanelGroup
							group="guide"
							label="Guides"
							panels={guidePanels}
							activeKey={sidePanel}
							onSelect={selectGuidePanel}
						/>

						<SidePanelGroup
							group="reference"
							label="Reference"
							panels={referencePanels}
							activeKey={sidePanel}
							onSelect={selectReferencePanel}
							className="mt-5"
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
								{features.map((feature, index) => (
									<SidebarTab
										key={feature.key}
										active={sidePanel === null && index === active}
										tabbable={index === active}
										label={feature.name}
										ariaLabel={
											feature.status === 'planned' ? `${feature.name}, coming soon` : feature.name
										}
										id={tabId(feature.key)}
										controls={panelId(feature.key)}
										onClick={() => selectFeature(index)}
									/>
								))}
							</div>
						</div>

						<nav aria-label="Stack" className="mt-5 flex flex-col gap-1">
							<SectionGroupLabel>Stack</SectionGroupLabel>
							<div className="flex flex-row flex-wrap gap-1 md:flex-col">
								<SectionJump label="Architectural Overview" target="architectural-overview" />
							</div>
						</nav>
					</div>

					<div className="min-w-0 flex-1">
						{referencePanels.map((panel) => (
							<PanelTabPanel
								key={panel.key}
								group="reference"
								panel={panel}
								active={sidePanel === panel.key}
							/>
						))}

						{guidePanels.map((panel) => (
							<PanelTabPanel
								key={panel.key}
								group="guide"
								panel={panel}
								active={sidePanel === panel.key}
							/>
						))}

						{features.map((feature, index) => (
							<div
								key={feature.key}
								role="tabpanel"
								id={panelId(feature.key)}
								aria-labelledby={tabId(feature.key)}
								hidden={sidePanel !== null || index !== active}
								className="mt-6 min-h-[calc(100svh-2rem)] rounded-xl border bg-muted/20 p-4 md:mt-0 md:p-6"
							>
								{sidePanel === null && index === active && <FeaturePanel feature={feature} />}
							</div>
						))}
					</div>
				</div>
			</section>
		</PanelNavigationProvider>
	)
}

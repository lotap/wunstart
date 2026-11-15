import {cn} from 'cn'
import {type RefObject, useEffect, useRef, useState} from 'react'

import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'

import {groupFlowSvgs, groups} from './framework-diagrams.ts'
import {frameworks} from './frameworks.ts'
import {ProjectTree} from './project-tree.tsx'

type Connector = {
	x: number
	y: number
	targetX: number
	turnY: number
	panelTop: number
}

type GroupPath = {
	tabIndex: number
	d: string
}

const connectorBundleRun = 40

// Matches --radius-sm in src/styles.css.
const connectorRadius = 6

type PathPoint = {
	x: number
	y: number
}

function getRoundedPath(points: Array<PathPoint>, radius = connectorRadius) {
	const first = points[0]
	const last = points[points.length - 1]

	if (!first || !last) return ''

	let path = `M ${first.x} ${first.y}`

	for (let index = 1; index < points.length - 1; index += 1) {
		const previous = points[index - 1]
		const current = points[index]
		const next = points[index + 1]

		if (!previous || !current || !next) continue

		const incoming = Math.hypot(current.x - previous.x, current.y - previous.y)
		const outgoing = Math.hypot(next.x - current.x, next.y - current.y)

		if (incoming === 0 || outgoing === 0) continue

		const cornerRadius = Math.min(radius, incoming / 2, outgoing / 2)
		const beforeX = current.x - ((current.x - previous.x) / incoming) * cornerRadius
		const beforeY = current.y - ((current.y - previous.y) / incoming) * cornerRadius
		const afterX = current.x + ((next.x - current.x) / outgoing) * cornerRadius
		const afterY = current.y + ((next.y - current.y) / outgoing) * cornerRadius

		path += ` L ${beforeX} ${beforeY} Q ${current.x} ${current.y} ${afterX} ${afterY}`
	}

	path += ` L ${last.x} ${last.y}`

	return path
}

function getConnectorPath({x, y, targetX, turnY, panelTop}: Connector) {
	if (Math.abs(targetX - x) < 0.5) return `M ${x} ${y} V ${panelTop}`

	return getRoundedPath([
		{x, y},
		{x, y: turnY},
		{x: targetX, y: turnY},
		{x: targetX, y: panelTop},
	])
}

type ShelfConnectorRefs = {
	wrapperRef: RefObject<HTMLDivElement | null>
	tablistRef: RefObject<HTMLDivElement | null>
	panelRef: RefObject<HTMLDivElement | null>
	infoRef: RefObject<HTMLDivElement | null>
}

function useShelfConnectors({wrapperRef, tablistRef, panelRef, infoRef}: ShelfConnectorRefs) {
	const [groupPaths, setGroupPaths] = useState<Array<GroupPath>>([])

	const [connectors, setConnectors] = useState<Array<Connector>>([])

	useEffect(() => {
		function measure() {
			const wrapper = wrapperRef.current
			const tablist = tablistRef.current
			const panel = panelRef.current
			const info = infoRef.current

			if (!wrapper || !tablist || !panel || !info) return

			const wrapperRect = wrapper.getBoundingClientRect()
			const panelTop = panel.getBoundingClientRect().top - wrapperRect.top
			const infoRect = info.getBoundingClientRect()
			const bundleCenter = infoRect.left + infoRect.width / 2 - wrapperRect.left
			const tabs = Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]'))

			const tabData = tabs.map((tab, index) => {
				const tabRect = tab.getBoundingClientRect()
				const x = tabRect.left + tabRect.width / 2 - wrapperRect.left

				return {
					index,
					x,
					top: tabRect.top - wrapperRect.top,
					bottom: tabRect.bottom - wrapperRect.top,
					distance: Math.abs(x - bundleCenter),
				}
			})

			if (tabData.length === 0) return

			const nextGroupPaths: Array<GroupPath> = []
			const groupLaneSpacing = 8
			const groupBundleRun = 26
			const groupTurnGap = 6

			groups.forEach((_, groupIndex) => {
				const bar = document.getElementById(`framework-group-${groupIndex}`)

				if (!bar) return

				const barRect = bar.getBoundingClientRect()

				const members = tabData.filter((tab) =>
					frameworks[tab.index]?.groupIndexes.includes(groupIndex),
				)

				if (members.length === 0) return

				const firstMember = members[0]

				if (!firstMember) return

				const groupWidth = (members.length - 1) * groupLaneSpacing

				const busLeft = barRect.left + 20 - wrapperRect.left

				const busCenter = busLeft + groupWidth / 2

				const barBottom = barRect.bottom - wrapperRect.top
				const tabTop = firstMember.top
				const groupTurnBottom = tabTop - groupTurnGap
				const groupTurnTop = barBottom + groupBundleRun
				const groupMaxRank = Math.max(members.length - 1, 1)
				const groupStep = Math.max(0, groupTurnBottom - groupTurnTop) / groupMaxRank

				// oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is outside this project's lib target
				const ranked = [...members].sort(
					(left, right) => Math.abs(right.x - busCenter) - Math.abs(left.x - busCenter),
				)

				const groupRankByIndex = new Map(ranked.map((tab, rank) => [tab.index, rank]))

				members.forEach((tab, lane) => {
					const targetX = busLeft + lane * groupLaneSpacing

					if (Math.abs(targetX - tab.x) < 0.5) {
						nextGroupPaths.push({
							tabIndex: tab.index,
							d: getRoundedPath([
								{x: tab.x, y: tab.top},
								{x: tab.x, y: barBottom},
							]),
						})

						return
					}

					const rank = groupRankByIndex.get(tab.index) ?? 0
					const turnY = groupTurnTop + rank * groupStep

					nextGroupPaths.push({
						tabIndex: tab.index,
						d: getRoundedPath([
							{x: tab.x, y: tab.top},
							{x: tab.x, y: turnY},
							{x: targetX, y: turnY},
							{x: targetX, y: barBottom},
						]),
					})
				})
			})

			setGroupPaths(nextGroupPaths)

			// oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is outside this project's lib target
			const sortedByX = [...tabData].sort((left, right) => left.x - right.x)

			const laneByIndex = new Map(sortedByX.map((tab, lane) => [tab.index, lane]))

			const leftOfCenter = tabData.filter((tab) => tab.x < bundleCenter)

			const rightOfCenter = tabData.filter((tab) => tab.x >= bundleCenter)

			// oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is outside this project's lib target
			const leftTabs = leftOfCenter.sort((left, right) => right.distance - left.distance)

			// oxlint-disable-next-line unicorn/no-array-sort -- ES2023 toSorted is outside this project's lib target
			const rightTabs = rightOfCenter.sort((left, right) => right.distance - left.distance)

			const maxRank = Math.max(leftTabs.length, rightTabs.length, 1) - 1

			const rankByIndex = new Map<number, number>()

			const topY = tabData[0]?.bottom ?? panelTop

			const laneSpacing = 8

			const busGap = 20

			const leftGroupWidth = Math.max(0, leftTabs.length - 1) * laneSpacing

			const rightGroupWidth = Math.max(0, rightTabs.length - 1) * laneSpacing

			const totalWidth = leftGroupWidth + busGap + rightGroupWidth

			const groupStart = bundleCenter - totalWidth / 2

			const leftGroupEnd = groupStart + leftGroupWidth

			const rightGapStart = leftGroupEnd + busGap

			const gapTabs = tabData.filter((tab) => tab.x > leftGroupEnd && tab.x < rightGapStart)

			const gapIndexes = new Set(gapTabs.map((tab) => tab.index))

			const firstGapTab = gapTabs[0]

			const rightLaneStart = firstGapTab ? firstGapTab.x + laneSpacing : rightGapStart

			const rightLaneByIndex = new Map<number, number>()

			for (const tab of sortedByX) {
				if (tab.x >= bundleCenter && !gapIndexes.has(tab.index)) {
					rightLaneByIndex.set(tab.index, rightLaneByIndex.size)
				}
			}

			const turnTop = topY + 6

			const turnBottom = panelTop - connectorBundleRun

			const step = Math.max(0, turnBottom - turnTop) / Math.max(1, maxRank)

			leftTabs.forEach((tab, rank) => rankByIndex.set(tab.index, rank))
			rightTabs.forEach((tab, rank) => rankByIndex.set(tab.index, rank))

			setConnectors(
				tabData.map((tab) => {
					const lane = laneByIndex.get(tab.index) ?? 0
					const rank = rankByIndex.get(tab.index) ?? 0

					const inBusGap = gapIndexes.has(tab.index)

					let targetX = tab.x

					if (!inBusGap) {
						if (tab.x < bundleCenter) {
							targetX = groupStart + lane * laneSpacing
						} else {
							const rightLane = rightLaneByIndex.get(tab.index) ?? 0

							targetX = rightLaneStart + rightLane * laneSpacing
						}
					}

					return {
						x: tab.x,
						y: tab.bottom,
						targetX,
						turnY: turnBottom - rank * step,
						panelTop,
					}
				}),
			)
		}

		measure()
		window.addEventListener('resize', measure)

		return () => window.removeEventListener('resize', measure)
	}, [wrapperRef, tablistRef, panelRef, infoRef])

	return {groupPaths, connectors}
}

export function FrameworkShelf() {
	const [active, setActive] = useState(0)

	const wrapperRef = useRef<HTMLDivElement>(null)
	const tablistRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	const infoRef = useRef<HTMLDivElement>(null)

	const {groupPaths, connectors} = useShelfConnectors({
		wrapperRef,
		tablistRef,
		panelRef,
		infoRef,
	})

	const selected = frameworks[active] ?? frameworks[0]!
	const activeConnector = connectors[active]

	const selectedFlows = selected.groupIndexes.flatMap((groupIndex) => {
		const group = groups[groupIndex]
		const svg = groupFlowSvgs[groupIndex]

		return group && svg ? [{group, svg}] : []
	})

	const selectedGroupIndexes = new Set(selected.groupIndexes)

	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
		// SAFETY: the active element is one of the tab buttons found above.
		const current = tabs.indexOf(document.activeElement as HTMLButtonElement)

		if (current === -1) return

		let next: number

		if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
		else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length
		else if (event.key === 'Home') next = 0
		else if (event.key === 'End') next = tabs.length - 1
		else return

		event.preventDefault()
		setActive(next)
		tabs[next]?.focus()
	}

	return (
		<div ref={wrapperRef} className="relative flex w-full flex-col gap-8 md:gap-32">
			<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase lg:hidden">
				Swipe the tabs
			</p>

			<div className="w-full scrollbar-none overflow-x-auto [&::-webkit-scrollbar]:hidden">
				<div className="flex flex-col gap-8 pt-6 md:gap-14">
					<div className="grid grid-cols-[repeat(14,minmax(3.5rem,1fr))] gap-1">
						{groups.map((group, barIndex) => {
							const isSelectedGroup = selectedGroupIndexes.has(barIndex)

							return (
								<div key={group.label} className={cn('flex flex-col gap-1', group.span)}>
									<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
										<span className="text-muted-foreground/50">{'//'}</span> {group.label}
									</p>
									<div
										id={`framework-group-${barIndex}`}
										className={cn('h-0.5', isSelectedGroup ? 'bg-foreground' : 'bg-foreground/15')}
									/>
								</div>
							)
						})}
					</div>

					<div
						ref={tablistRef}
						role="tablist"
						aria-label="Frameworks used by wunstart"
						tabIndex={-1}
						onKeyDown={handleKeyDown}
						className="grid grid-cols-[repeat(14,minmax(3.5rem,1fr))] gap-1"
					>
						{frameworks.map((framework, index) => {
							const isActive = active === index

							return (
								<button
									key={framework.slug}
									type="button"
									role="tab"
									id={`framework-tab-${framework.slug}`}
									aria-label={`${framework.name}, ${framework.role}`}
									aria-selected={isActive}
									aria-controls="framework-panel"
									tabIndex={isActive ? 0 : -1}
									onClick={() => setActive(index)}
									className={cn(
										'flex h-40 w-full min-w-0 items-center justify-center rounded-4xl border-2 bg-background px-0 py-4 text-muted-foreground transition-[background-color,border-color,color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
										isActive
											? 'border-foreground/60 bg-muted/50 text-foreground'
											: 'border-border hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground',
									)}
								>
									<span className="font-mono text-xs tracking-widest uppercase [writing-mode:vertical-rl]">
										{framework.name}
									</span>
								</button>
							)
						})}
					</div>
				</div>
			</div>

			<div
				ref={panelRef}
				role="tabpanel"
				id="framework-panel"
				aria-labelledby={`framework-tab-${selected.slug}`}
				tabIndex={0}
				className="overflow-hidden rounded-xl border bg-muted/20 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
			>
				<div className="grid md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
					<div ref={infoRef} className="flex min-w-0 flex-col md:order-2 md:border-l">
						<div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
							<div className="flex flex-col gap-2">
								<h4 className="text-3xl">{selected.name}</h4>
								<div className="flex flex-wrap items-center gap-3">
									<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
										{selected.role}
									</p>
									<span className="font-mono text-xs tracking-widest uppercase">
										<ExternalDocLink href={selected.docs}>
											{selected.docs.includes('github.com') ? 'GitHub' : 'Docs'}
										</ExternalDocLink>
									</span>
								</div>
								<p className="mt-2 text-muted-foreground">{selected.description}</p>
							</div>
							<div className="flex flex-col gap-6">
								{selectedFlows.map(({group, svg}, index) => (
									<div
										key={group.label}
										className={cn('flex flex-col gap-2', index > 0 && 'border-t pt-6')}
									>
										<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
											{group.label} · {group.flowTitle}
										</p>
										<div
											// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable diagram needs keyboard focus
											tabIndex={0}
											aria-label={`${group.label} ${group.flowTitle} diagram`}
											className="mt-1 h-45 scrollbar-thin overflow-x-auto"
										>
											<div
												suppressHydrationWarning
												className="flex h-full w-max items-center [&_svg]:h-auto [&_svg]:max-h-45 [&_svg]:w-auto [&_svg]:max-w-none [&_svg]:font-medium! dark:[&_svg]:font-normal!"
												// Static Mermaid source rendered by Pele at module load. No user input.
												dangerouslySetInnerHTML={{__html: svg}}
											/>
										</div>
									</div>
								))}
								<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase md:hidden">
									Scroll to explore
								</p>
							</div>
							<div className="mt-auto flex flex-col gap-4">
								{selected.skills.length > 0 && (
									<div className="flex flex-col gap-1">
										<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
											Associated skills
										</p>
										<p className="font-mono text-xs text-muted-foreground">
											{selected.skills.join(' · ')}
										</p>
									</div>
								)}
								<div className="flex flex-col gap-1">
									<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
										Where it lives
									</p>
									<p className="font-mono text-xs text-muted-foreground">{selected.where}</p>
								</div>
							</div>
						</div>
					</div>

					<ProjectTree areas={selected.areas} />
				</div>
			</div>

			{groupPaths.length > 0 && (
				<svg
					aria-hidden="true"
					data-group-connectors="true"
					className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full lg:block"
				>
					{groupPaths.map((path) => (
						<path
							key={`group-path-${path.d}`}
							d={path.d}
							fill="none"
							strokeWidth={1}
							className={path.tabIndex === active ? 'stroke-foreground' : 'stroke-foreground/15'}
						/>
					))}
				</svg>
			)}

			{connectors.length > 0 && (
				<svg
					aria-hidden="true"
					data-connectors="true"
					className="pointer-events-none absolute inset-0 z-10 hidden h-full w-full lg:block"
				>
					{connectors.map((connector, index) => {
						if (index === active) return null

						return (
							<path
								key={`connector-${connector.x}`}
								d={getConnectorPath(connector)}
								fill="none"
								strokeWidth={1}
								className="stroke-foreground/15"
							/>
						)
					})}
					{activeConnector && (
						<path
							d={getConnectorPath(activeConnector)}
							fill="none"
							strokeWidth={1}
							className="stroke-foreground"
						/>
					)}
				</svg>
			)}
		</div>
	)
}

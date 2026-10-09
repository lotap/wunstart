import {cva} from 'class-variance-authority'
import {ChevronDown, ChevronLeft} from 'lucide-react'
import {useState, type ComponentType, type CSSProperties} from 'react'

import {RouterButton} from '#/components/router-button.tsx'
import {Card, CardAction, CardContent, CardHeader, CardTitle} from '#/components/ui/card.tsx'

import {CATEGORIES, type CategoryId} from '../categories.ts'
import {AccessAndSecurity} from './access-and-security.tsx'
import {PinButton} from './pin-button.tsx'
import {Preferences} from './preferences.tsx'
import {Profile} from './profile.tsx'

/** Attaches each category to its section component. Exhaustive by construction */
const CATEGORY_COMPONENTS = {
	preferences: Preferences,
	profile: Profile,
	access: AccessAndSecurity,
} satisfies Record<CategoryId, ComponentType>

const settingsSectionVariants = cva('order-(--cat-order) md:order-(--cat-order-md) md:p-0', {
	variants: {last: {true: 'grow'}},
})

export function SettingsPage({activeCategories}: {activeCategories: readonly CategoryId[]}) {
	const [pinned, setPinned] = useState<CategoryId[]>([])

	const nextPins = (id: CategoryId) =>
		pinned.includes(id) ? pinned.filter((c) => c !== id) : pinned

	const nextCats = (id: CategoryId, nextPinned: CategoryId[]) => {
		if (activeCategories.includes(id)) {
			const remaining = activeCategories.filter((c) => c !== id)
			return remaining.length > 0 ? remaining : [id]
		}

		return [...new Set([...nextPinned, id])]
	}

	const togglePinned = (id: CategoryId) =>
		setPinned((p) => (p.includes(id) ? p.filter((c) => c !== id) : [...p, id]))

	return (
		<div className="mx-auto flex h-full max-w-5xl flex-col gap-2 p-2 md:flex-row md:gap-4">
			<nav className="contents gap-2 py-2 md:flex md:flex-col">
				{CATEGORIES.map(({id, label, Icon}, i) => {
					const isExpanded = activeCategories.includes(id)
					return (
						<div
							key={id}
							className="order-(--cat-order) flex items-center justify-between"
							// SAFETY: custom vars are not automatically recognized as CSS
							style={{'--cat-order': i * 2} as CSSProperties}
						>
							<RouterButton
								from={'/settings'}
								search={(prev) => ({
									...prev,
									categories: nextCats(id, nextPins(id)),
								})}
								replace
								viewTransition={false}
								onClick={() => {
									const nextPinned = nextPins(id)
									if (nextPinned.length !== pinned.length) setPinned(nextPinned)
								}}
								aria-expanded={isExpanded}
								variant={isExpanded ? 'secondary' : 'ghost'}
								size="lg"
								className="grow justify-between text-muted-foreground"
							>
								<span className="flex items-center gap-2">
									<Icon data-icon="inline-start" />
									{label}
								</span>
								{isExpanded ? (
									<ChevronDown data-icon="inline-end" className="md:hidden" />
								) : (
									<ChevronLeft data-icon="inline-end" className="md:hidden" />
								)}
							</RouterButton>

							{isExpanded && (
								<PinButton
									isPinned={pinned.includes(id)}
									label={label}
									onToggle={() => togglePinned(id)}
									variant={pinned.includes(id) ? 'secondary' : 'ghost'}
									size="icon-lg"
									className="text-muted-foreground md:hidden"
								/>
							)}
						</div>
					)
				})}
			</nav>

			<div className="contents gap-2 md:flex md:w-full md:flex-col">
				{CATEGORIES.map(({id, label}, i) => {
					const catOrder = activeCategories.indexOf(id) + 1
					const CatComponent = CATEGORY_COMPONENTS[id]
					return (
						activeCategories.includes(id) && (
							<section
								key={id}
								// SAFETY: custom vars are not automatically recognized as CSS
								style={
									{
										'--cat-order': i * 2 + 1,
										'--cat-order-md': catOrder,
									} as CSSProperties
								}
								className={settingsSectionVariants({last: catOrder === activeCategories.length})}
							>
								<Card className="h-full">
									<CardHeader className="hidden md:grid">
										<CardTitle>
											<h2 className="text-muted-foreground md:block">{label}</h2>
										</CardTitle>
										<CardAction>
											<PinButton
												isPinned={pinned.includes(id)}
												label={label}
												onToggle={() => togglePinned(id)}
												variant={pinned.includes(id) ? 'default' : 'ghost'}
												size="icon"
												className="text-muted-foreground"
											/>
										</CardAction>
									</CardHeader>
									<CardContent>
										<CatComponent />
									</CardContent>
								</Card>
							</section>
						)
					)
				})}
			</div>
		</div>
	)
}

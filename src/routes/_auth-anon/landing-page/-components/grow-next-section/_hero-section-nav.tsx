import {cva} from 'class-variance-authority'
import {cn} from 'cn'
import {ArrowUp, ChevronDown} from 'lucide-react'
import {type MouseEvent, type RefObject, useRef, useState} from 'react'

import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'
import {useDismissibleMenu} from '#/hooks/use-dismissible-menu.ts'
import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

import {HERO_SECTION_IDS, HERO_SECTION_LINKS} from '../../-content/hero.ts'
import {useActiveSection} from '../../-hooks/use-active-section.ts'
import {scrollToStartPanel} from '../../-utils/cta.ts'

const menuVariants = cva(
	'absolute inset-x-0 z-10 flex-col gap-0.5 rounded-3xl bg-background/95 p-1 shadow-md ring-1 ring-foreground/10 backdrop-blur-md lg:static lg:z-auto lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-1 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none',
	{
		variants: {
			open: {true: 'flex', false: 'hidden'},
			direction: {
				down: 'top-full mt-1 lg:mt-0',
				up: 'bottom-full mb-1 lg:mb-0',
			},
		},
		defaultVariants: {open: false, direction: 'down'},
	},
)

const sectionLinkVariants = cva(
	'flex h-9 w-full items-center justify-start rounded-full px-3 text-xs font-semibold whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:w-auto lg:justify-center lg:px-4 lg:text-sm dark:font-medium',
	{
		variants: {
			emphasis: {
				true: 'hidden bg-foreground text-background hover:bg-foreground/90 hover:text-background lg:flex',
				false: 'text-muted-foreground',
			},
			active: {true: '', false: ''},
		},
		compoundVariants: [
			{
				emphasis: true,
				active: true,
				class: 'ring-2 ring-ring ring-offset-2 ring-offset-background',
			},
			{emphasis: false, active: true, class: 'bg-foreground/10 text-foreground'},
		],
		defaultVariants: {emphasis: false, active: false},
	},
)

const emphasisPillVariants = cva(
	'flex h-9 shrink-0 items-center rounded-full bg-foreground px-3 text-xs font-semibold whitespace-nowrap text-background transition-colors hover:bg-foreground/90 hover:text-background focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden dark:font-medium',
	{
		variants: {
			active: {true: 'ring-2 ring-ring ring-offset-2 ring-offset-background'},
		},
		defaultVariants: {active: false},
	},
)

function getTriggerLabel(menuOpen: boolean, activeLabel: string | undefined) {
	if (menuOpen) return 'Close section navigation'

	if (!activeLabel) return 'Open section navigation'

	return `Open section navigation. Current section: ${activeLabel}`
}

/** Section navigation that starts inside the hero and docks to the viewport top. */
export function HeroSectionNav({
	navRef,
	slotRef,
}: {
	navRef: RefObject<HTMLElement | null>
	slotRef: RefObject<HTMLDivElement | null>
}) {
	const activeSection = useActiveSection(HERO_SECTION_IDS)
	const reduceMotion = useReducedMotion()
	const [menuOpen, setMenuOpen] = useState(false)
	const [menuDirection, setMenuDirection] = useState<'down' | 'up'>('down')
	const triggerRef = useRef<HTMLButtonElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)

	/** Transient so it never fights the hero’s scroll choreography. */
	useDismissibleMenu({
		open: menuOpen,
		setOpen: setMenuOpen,
		containerRef: navRef,
		triggerRef,
	})

	const activeLink = HERO_SECTION_LINKS.find((link) => link.href.slice(1) === activeSection)
	const activeName = activeLink?.label ?? 'Sections'

	const emphasisLink = HERO_SECTION_LINKS.find((link) => link.emphasis)

	const triggerLabel = getTriggerLabel(menuOpen, activeLink?.label)

	const scrollToTop = () => {
		setMenuOpen(false)
		window.scrollTo({top: 0, behavior: reduceMotion ? 'auto' : 'smooth'})
	}

	/** Skip the CTA intro and land on the install panels. */
	const handleStartPanelClick = (event: MouseEvent<HTMLAnchorElement>) => {
		setMenuOpen(false)

		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
			return
		}

		if (scrollToStartPanel({behavior: reduceMotion ? 'instant' : 'smooth'})) {
			event.preventDefault()
		}
	}

	/** Flip the dropdown above the pill when it sits near the viewport bottom. */
	useIsomorphicLayoutEffect(() => {
		if (!menuOpen) return

		const nav = navRef.current
		const menu = menuRef.current

		if (!nav || !menu) return

		const navRect = nav.getBoundingClientRect()
		const needed = menu.offsetHeight + 4
		const roomBelow = window.innerHeight - navRect.bottom
		const roomAbove = navRect.top

		setMenuDirection(roomBelow >= needed || roomBelow >= roomAbove ? 'down' : 'up')
	}, [menuOpen, navRef])

	return (
		<div
			ref={slotRef}
			className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 [@media(max-height:700px)]:-bottom-7"
		>
			<nav
				ref={navRef}
				aria-label="Landing page sections"
				className="pointer-events-auto flex w-72 max-w-full flex-col items-stretch gap-0.5 rounded-3xl bg-background p-1 shadow-sm ring-1 ring-foreground/10 transition-colors data-[ready=true]:fixed data-[ready=true]:top-0 data-[ready=true]:left-1/2 data-[ready=true]:z-40 data-[ready=true]:-translate-x-1/2 lg:w-auto lg:flex-row lg:items-center lg:gap-1 lg:rounded-full lg:p-1.5"
			>
				<div className="flex w-full items-center gap-0.5 lg:w-auto">
					<Tooltip>
						<TooltipTrigger
							delay={300}
							render={
								<button
									type="button"
									aria-label="Scroll to top"
									onClick={scrollToTop}
									className="hidden size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:flex lg:size-9"
								>
									<ArrowUp className="size-4" aria-hidden="true" />
								</button>
							}
						/>
						<TooltipContent side="bottom">Scroll to top</TooltipContent>
					</Tooltip>

					<button
						ref={triggerRef}
						type="button"
						aria-expanded={menuOpen}
						aria-controls="hero-section-links"
						aria-label={triggerLabel}
						onClick={() => setMenuOpen((open) => !open)}
						className="flex h-9 flex-1 items-center justify-between gap-2 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden dark:font-medium"
					>
						<span className="truncate">{activeName}</span>
						<ChevronDown
							aria-hidden="true"
							className={cn('size-4 shrink-0 transition-transform', menuOpen && 'rotate-180')}
						/>
					</button>

					{emphasisLink ? (
						<a
							href={emphasisLink.href}
							aria-current={activeSection === emphasisLink.href.slice(1) ? 'location' : undefined}
							onClick={handleStartPanelClick}
							className={emphasisPillVariants({
								active: activeSection === emphasisLink.href.slice(1),
							})}
						>
							{emphasisLink.label}
						</a>
					) : null}
				</div>

				<div
					ref={menuRef}
					id="hero-section-links"
					className={menuVariants({open: menuOpen, direction: menuDirection})}
				>
					<button
						type="button"
						onClick={scrollToTop}
						className="flex h-9 w-full items-center justify-start gap-2 rounded-full px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden dark:font-medium"
					>
						<ArrowUp className="size-4" aria-hidden="true" />
						Back to top
					</button>

					{HERO_SECTION_LINKS.map((link) => {
						const isActive = activeSection === link.href.slice(1)

						return (
							<a
								key={link.href}
								href={link.href}
								aria-current={isActive ? 'location' : undefined}
								onClick={link.emphasis ? handleStartPanelClick : () => setMenuOpen(false)}
								className={sectionLinkVariants({
									emphasis: Boolean(link.emphasis),
									active: isActive,
								})}
							>
								{link.label}
							</a>
						)
					})}
				</div>
			</nav>
		</div>
	)
}

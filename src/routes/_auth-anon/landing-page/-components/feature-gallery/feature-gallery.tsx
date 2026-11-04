import {cva} from 'class-variance-authority'
import {cn} from 'cn'
import {useRef, useState} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

import {conversations} from '../../-content/conversations.ts'
import {useGalleryActive} from '../../-hooks/use-gallery-active.ts'
import {Conversation} from './_conversation.tsx'

/** Reveal window for every conversation, in viewport heights. */
const CONVERSATION_REVEAL_START_VH = 80
const CONVERSATION_REVEAL_END_VH = 55

const galleryChromeVariants = cva(
	'transition-opacity duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
	{
		variants: {
			state: {
				visible: 'opacity-100',
				hidden: 'pointer-events-none opacity-0',
			},
		},
		defaultVariants: {state: 'hidden'},
	},
)

const galleryScrollerVariants = cva(
	'w-full snap-x snap-mandatory scrollbar-none [&::-webkit-scrollbar]:hidden',
	{
		variants: {
			active: {
				true: 'overflow-x-auto overflow-y-hidden overscroll-x-contain',
				false: 'overflow-hidden',
			},
		},
		defaultVariants: {active: false},
	},
)

const galleryDotVariants = cva(
	'h-2 w-6 rounded-full transition-[clip-path,background-color] duration-300 motion-reduce:transition-none',
	{
		variants: {
			active: {
				true: 'bg-foreground [clip-path:inset(0_0_0_0_round_4px)]',
				false:
					'bg-foreground/20 [clip-path:inset(0_8px_0_8px_round_4px)] group-hover:bg-foreground/40',
			},
		},
		defaultVariants: {active: false},
	},
)

function ConversationLabel({active, children}: {active: boolean; children: string}) {
	return (
		<p
			aria-hidden={active ? undefined : true}
			className={cn(
				'font-mono text-xs tracking-widest text-muted-foreground uppercase',
				'mt-8 text-center',
				galleryChromeVariants({state: active ? 'visible' : 'hidden'}),
			)}
		>
			{children}
		</p>
	)
}

function getClosestSlide(scroller: HTMLDivElement) {
	const scrollerRect = scroller.getBoundingClientRect()
	const center = scrollerRect.left + scrollerRect.width / 2
	let closest = 0
	let closestDistance = Number.POSITIVE_INFINITY

	scroller.querySelectorAll<HTMLElement>('[data-slide-index]').forEach((slide, index) => {
		const rect = slide.getBoundingClientRect()
		const distance = Math.abs(rect.left + rect.width / 2 - center)

		if (distance < closestDistance) {
			closest = index
			closestDistance = distance
		}
	})

	return closest
}

export function FeatureGallery() {
	const galleryRef = useRef<HTMLElement>(null)
	const scrollerRef = useRef<HTMLDivElement>(null)
	const targetRef = useRef<number | null>(null)
	const scrollFrameRef = useRef(0)
	const [activeSlide, setActiveSlide] = useState(0)
	const reduceMotion = useReducedMotion()
	const active = useGalleryActive(galleryRef, CONVERSATION_REVEAL_END_VH)

	useIsomorphicLayoutEffect(() => {
		const scroller = scrollerRef.current

		if (!scroller) return

		// Start every page load on the first example. The browser can restore a
		// horizontal position that the initial state does not know about.
		scroller.scrollLeft = 0

		const handleScrollEnd = () => {
			targetRef.current = null
			setActiveSlide(getClosestSlide(scroller))
		}

		scroller.addEventListener('scrollend', handleScrollEnd)

		return () => {
			scroller.removeEventListener('scrollend', handleScrollEnd)

			if (scrollFrameRef.current) {
				cancelAnimationFrame(scrollFrameRef.current)
				scrollFrameRef.current = 0
			}
		}
	}, [])

	const handleScroll = () => {
		if (scrollFrameRef.current) return

		scrollFrameRef.current = requestAnimationFrame(() => {
			scrollFrameRef.current = 0

			const scroller = scrollerRef.current

			if (!scroller) return

			const closest = getClosestSlide(scroller)

			// While a dot click is scrolling, keep the clicked dot active until
			// the scroll actually reaches it instead of flashing the old one.
			if (targetRef.current !== null) {
				if (closest !== targetRef.current) return

				targetRef.current = null
			}

			setActiveSlide(closest)
		})
	}

	const scrollToSlide = (index: number) => {
		const scroller = scrollerRef.current

		if (!scroller) return

		const slide = scroller.querySelector<HTMLElement>(`[data-slide-index="${index}"]`)

		if (!slide) return

		const scrollerRect = scroller.getBoundingClientRect()
		const slideRect = slide.getBoundingClientRect()

		targetRef.current = index
		setActiveSlide(index)

		scroller.scrollTo({
			left:
				scroller.scrollLeft +
				slideRect.left -
				scrollerRect.left -
				(scrollerRect.width - slideRect.width) / 2,
			behavior: reduceMotion ? 'auto' : 'smooth',
		})
	}

	return (
		<section
			ref={galleryRef}
			aria-label="Feature examples"
			data-reveal="exit"
			className="flex w-full flex-col gap-6"
		>
			<div ref={scrollerRef} onScroll={handleScroll} className={galleryScrollerVariants({active})}>
				<div className="flex w-max gap-8 px-[calc((100%-48rem)/2)] py-6 max-sm:gap-4 max-sm:px-8">
					{conversations.map((conversation, index) => {
						const selected = activeSlide === index
						const visible = active || selected || index === 0

						return (
							<div
								key={conversation.label}
								data-slide-index={index}
								aria-hidden={visible ? undefined : true}
								className={cn(
									'flex w-3xl shrink-0 snap-center flex-col max-sm:w-[calc(100vw-6rem)]',
									galleryChromeVariants({state: visible ? 'visible' : 'hidden'}),
								)}
							>
								<Conversation
									messages={conversation.messages}
									revealStartVh={CONVERSATION_REVEAL_START_VH}
									revealEndVh={CONVERSATION_REVEAL_END_VH}
									bordered={active}
									galleryTrigger={index === 0}
								/>

								<ConversationLabel active={active}>{conversation.label}</ConversationLabel>
							</div>
						)
					})}
				</div>
			</div>

			<div
				aria-hidden={active ? undefined : true}
				className={cn(
					'flex items-center justify-center gap-1',
					galleryChromeVariants({state: active ? 'visible' : 'hidden'}),
				)}
			>
				{conversations.map((conversation, index) => (
					<button
						key={conversation.label}
						type="button"
						aria-label={`Show ${conversation.label} example`}
						aria-current={activeSlide === index ? 'true' : undefined}
						tabIndex={active ? undefined : -1}
						onClick={() => scrollToSlide(index)}
						className="group flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<span className="flex h-2 w-6 items-center justify-center">
							<span className={galleryDotVariants({active: activeSlide === index})} />
						</span>
					</button>
				))}
			</div>
		</section>
	)
}

import {useRef, useState} from 'react'

import {Button} from '#/components/ui/button.tsx'
import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

import {useGrowNextScroll} from '../../-hooks/use-grow-next-scroll.ts'
import {scrollToStartPanel} from '../../-utils/cta.ts'
import {
	BOXES_BLOCK_TOP_VH,
	HEADLINE_STICKY_HEIGHT_CSS,
	SECTION_HEIGHT_CSS,
	SHADER_INSET_VH,
	SHADER_PARENT_HEIGHT_CSS,
	SHADER_STICKY_HEIGHT_VH,
	SHADER_STICKY_TOP_VH,
	STICKY_TOP_VH,
} from '../../-utils/hero-layout.ts'
import {StartPrompt} from '../start-prompt.tsx'
import {GrowNextBackground} from './_background.tsx'
import {FeatureBoxes} from './_feature-boxes.tsx'
import {FeaturesText} from './_features-text.tsx'
import {Headline} from './_headline.tsx'
import {HeroSectionNav} from './_hero-section-nav.tsx'

/**
 * Scroll-held headline: “Bring your next” stays fixed while each word rises
 * through a clipped slot, followed by “to life.” The headline then scrolls up
 * over a shader that stays pinned through the subline and feature reveal.
 */
export function GrowNextSection({onManualInstall}: {onManualInstall: () => void}) {
	const sectionRef = useRef<HTMLElement>(null)
	const svhProbeRef = useRef<HTMLDivElement>(null)
	const shaderParentRef = useRef<HTMLDivElement>(null)
	const slotRef = useRef<HTMLSpanElement>(null)
	const headlineRef = useRef<HTMLHeadingElement>(null)
	const headlineLeadRef = useRef<HTMLSpanElement>(null)
	const headlineTailRef = useRef<HTMLSpanElement>(null)
	const promptRef = useRef<HTMLDivElement>(null)
	const navRef = useRef<HTMLElement>(null)
	const navSlotRef = useRef<HTMLDivElement>(null)
	const sublineRef = useRef<HTMLParagraphElement>(null)
	const sublineWordRefs = useRef<Array<HTMLSpanElement | null>>([])
	const boxesBlockRef = useRef<HTMLDivElement>(null)
	const scrimRef = useRef<HTMLDivElement>(null)
	const cardRefs = useRef<Array<HTMLLIElement | null>>([])
	const wordRefs = useRef<Array<HTMLSpanElement | null>>([])
	const hasSizedSlot = useRef(false)
	const reduceMotion = useReducedMotion()
	const [activeIndex, setActiveIndex] = useState(0)

	const handleManualInstall = () => {
		onManualInstall()
		scrollToStartPanel({behavior: reduceMotion ? 'instant' : 'smooth'})
	}

	/**
	 * Size the slot to the active word so “to life” stays tight against it.
	 * The width transition is the effect: the slot shrinks under the outgoing
	 * word while it leaves, and the tail follows on desktop. An instant resize
	 * crops the outgoing word, so width stays the measured-layout exception.
	 */
	useIsomorphicLayoutEffect(() => {
		const slot = slotRef.current
		const word = wordRefs.current[activeIndex]

		if (!slot || !word) return

		let frame = 0

		const measure = () => {
			const styles = getComputedStyle(slot)
			const padding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight)
			const width = word.offsetWidth + padding

			if (!hasSizedSlot.current) {
				slot.style.transition = 'none'
				slot.style.width = `${width}px`
				hasSizedSlot.current = true
				frame = requestAnimationFrame(() => {
					slot.style.transition = ''
				})

				return
			}

			slot.style.transition = ''
			slot.style.width = `${width}px`
		}

		measure()

		const observer = new ResizeObserver(measure)
		observer.observe(word)

		return () => {
			observer.disconnect()

			if (frame) cancelAnimationFrame(frame)
		}
	}, [activeIndex])

	useGrowNextScroll({
		sectionRef,
		svhProbeRef,
		shaderParentRef,
		headlineRef,
		headlineLeadRef,
		slotRef,
		headlineTailRef,
		promptRef,
		navRef,
		navSlotRef,
		sublineRef,
		sublineWordRefs,
		boxesBlockRef,
		scrimRef,
		cardRefs,
		reduceMotion,
		onActiveIndexChange: setActiveIndex,
	})

	return (
		<section
			ref={sectionRef}
			aria-labelledby="grow-next-heading"
			className="relative isolate z-30"
			style={{height: SECTION_HEIGHT_CSS}}
		>
			<div
				ref={svhProbeRef}
				aria-hidden="true"
				className="pointer-events-none absolute top-0 left-0 h-[1svh] w-px opacity-0"
			/>
			{/*
			 * The shader layer owns the clip. Clipping the section instead would
			 * also clip the fixed hero nav in WebKit.
			 */}
			<div
				ref={shaderParentRef}
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 overflow-clip"
				style={{height: SHADER_PARENT_HEIGHT_CSS}}
			>
				<div
					className="sticky"
					style={{
						top: `${SHADER_STICKY_TOP_VH}svh`,
						height: `${SHADER_STICKY_HEIGHT_VH}svh`,
					}}
				>
					<GrowNextBackground
						insetVh={SHADER_INSET_VH}
						noise={0.7}
						intensity={0.6}
						softness={0.4}
					/>
				</div>
			</div>
			<div className="pointer-events-none absolute inset-0">
				<div
					data-headline-layer
					className="sticky z-40"
					style={{
						top: `${STICKY_TOP_VH}svh`,
						height: HEADLINE_STICKY_HEIGHT_CSS,
					}}
				>
					<div className="relative" style={{height: `${100 - STICKY_TOP_VH * 2}svh`}}>
						<div className="flex h-full translate-y-[-12svh] items-center justify-center overflow-x-clip px-4 [@media(min-height:701px)_and_(max-width:639px)]:translate-y-[-10svh] [@media(min-height:701px)_and_(min-width:640px)]:translate-y-[-8svh]">
							<div className="relative w-full">
								<Headline
									activeIndex={activeIndex}
									headlineRef={headlineRef}
									headlineLeadRef={headlineLeadRef}
									slotRef={slotRef}
									headlineTailRef={headlineTailRef}
									wordRefs={wordRefs}
								/>
							</div>
						</div>
						{/* Fixed in the hero layer so it stays centered while the subline lands. */}
						<div
							ref={promptRef}
							className="pointer-events-auto absolute inset-x-0 bottom-25 flex justify-center px-4 sm:bottom-30 [@media(max-height:700px)]:bottom-7 sm:[@media(max-height:820px)]:bottom-24 [@media(min-width:640px)_and_(min-height:940px)]:bottom-32"
						>
							<StartPrompt
								className="w-full max-w-2xl text-xs sm:text-sm"
								action={
									<Button
										type="button"
										variant="ghost"
										size="xs"
										onClick={handleManualInstall}
										className="-my-1"
									>
										Manual install
									</Button>
								}
							/>
						</div>
						<HeroSectionNav navRef={navRef} slotRef={navSlotRef} />
					</div>
				</div>
			</div>
			<FeaturesText sublineRef={sublineRef} sublineWordRefs={sublineWordRefs} />
			<div
				ref={scrimRef}
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0"
				style={{
					top: `${BOXES_BLOCK_TOP_VH}svh`,
					bottom: 0,
					background:
						'linear-gradient(to bottom, transparent 0%, var(--background) var(--scrim-stop, 87%), var(--background) 100%)',
				}}
			/>
			<FeatureBoxes boxesBlockRef={boxesBlockRef} cardRefs={cardRefs} />
		</section>
	)
}

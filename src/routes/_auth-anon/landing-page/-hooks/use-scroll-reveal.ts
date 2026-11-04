import {type RefObject} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

import {easeOut} from '../-utils/ease.ts'
import {clamp01} from '../-utils/math.ts'
import {supportsTextBlur} from '../-utils/supports-text-blur.ts'
import {getViewportHeight} from '../-utils/viewport.ts'

/** Viewport position where a revealed block starts fading in, in viewport heights. */
const REVEAL_ENTER_START_VH = 70

/** Viewport position where a revealed block is fully visible, in viewport heights. */
const REVEAL_ENTER_END_VH = 40

/** Viewport position where a short block starts fading out, in viewport heights. */
const REVEAL_EXIT_TOP_VH = 10

/** Viewport position where a tall block starts fading out, in viewport heights. */
const REVEAL_EXIT_BOTTOM_VH = 30

/** Vertical offset at the start of the entrance, in pixels. */
const REVEAL_ENTER_SHIFT_PX = 24

/** Extra upward shift at the end of the exit, in pixels. */
const REVEAL_EXIT_SHIFT_PX = 24

/** Blur at the end of the exit, in pixels. */
const REVEAL_EXIT_BLUR_PX = 4

type RevealState = {
	enter: number
	exit: number
}

/**
 * Reveal every `[data-reveal]` block inside the container as it scrolls
 * through the viewport. Blocks rise in from below. Blocks marked
 * `data-reveal="enter"` only fade in and stay visible, which keeps content
 * inside horizontal scrollers from disappearing as the page moves on. Blocks
 * marked `data-reveal="exit"` start visible and only fade out at the top. The
 * rest fade out at the top, mirroring the feature cards. Tall blocks wait
 * until their lower edge is near the top before they start fading, so content
 * is not dimmed while it is still being read.
 */
export function useScrollReveal(
	containerRef: RefObject<HTMLElement | null>,
	svhProbeRef: RefObject<HTMLElement | null>,
) {
	const reduceMotion = useReducedMotion()

	useIsomorphicLayoutEffect(() => {
		const container = containerRef.current

		if (!container) return

		const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-reveal]'))

		if (elements.length === 0) return

		const lastStates = new Map<HTMLElement, RevealState>()
		let frame = 0

		const update = () => {
			frame = 0

			const viewport = getViewportHeight(svhProbeRef.current)

			if (viewport <= 0) return

			const measurements = elements.map((element) => {
				const rect = element.getBoundingClientRect()
				const previous = lastStates.get(element)

				/** Remove the reveal transform so it does not feed back into the progress. */
				const appliedShiftPx =
					reduceMotion || !previous
						? 0
						: (1 - previous.enter) * REVEAL_ENTER_SHIFT_PX - previous.exit * REVEAL_EXIT_SHIFT_PX

				return {
					element,
					topVh: ((rect.top - appliedShiftPx) / viewport) * 100,
					heightVh: (rect.height / viewport) * 100,
					previous,
				}
			})

			for (const {element, topVh, heightVh, previous} of measurements) {
				const enterOnly = element.dataset['reveal'] === 'enter'
				const delayVh = Number(element.dataset['revealDelay'] ?? 0)
				const enterAnchorVh = topVh + delayVh

				const enterStartVh = Number(element.dataset['revealStart'] ?? REVEAL_ENTER_START_VH)

				const enterEndVh = Number(element.dataset['revealEnd'] ?? REVEAL_ENTER_END_VH)

				const enterRaw = clamp01((enterStartVh - enterAnchorVh) / (enterStartVh - enterEndVh))

				const enter = element.dataset['reveal'] === 'exit' ? 1 : easeOut(enterRaw)

				const exitStartTopVh = Math.min(REVEAL_EXIT_TOP_VH, REVEAL_EXIT_BOTTOM_VH - heightVh)
				const exitBandVh = Math.max(exitStartTopVh + heightVh, 0.001)
				const exitRaw = clamp01((exitStartTopVh - topVh) / exitBandVh)

				const exit = enterOnly ? 0 : easeOut(exitRaw)

				if (previous?.enter === enter && previous.exit === exit) continue

				lastStates.set(element, {enter, exit})

				const opacity = enter * (1 - exit)
				const exitBlur = exit * REVEAL_EXIT_BLUR_PX

				element.style.opacity = `${opacity}`
				element.style.pointerEvents = opacity < 0.05 ? 'none' : ''
				element.style.transform = reduceMotion
					? ''
					: `translateY(${(1 - enter) * REVEAL_ENTER_SHIFT_PX - exit * REVEAL_EXIT_SHIFT_PX}px)`
				element.style.filter =
					reduceMotion || !supportsTextBlur || exitBlur === 0 ? '' : `blur(${exitBlur}px)`
			}
		}

		const schedule = () => {
			if (frame) return

			frame = requestAnimationFrame(update)
		}

		update()
		window.addEventListener('scroll', schedule, {passive: true})
		window.addEventListener('resize', schedule)

		const resizeObserver = new ResizeObserver(schedule)
		resizeObserver.observe(container)

		return () => {
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			resizeObserver.disconnect()

			if (frame) cancelAnimationFrame(frame)
		}
	}, [containerRef, reduceMotion, svhProbeRef])
}

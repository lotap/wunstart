import {type RefObject} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

import {easeOut} from '../-utils/ease.ts'
import {clamp01} from '../-utils/math.ts'
import {supportsTextBlur} from '../-utils/supports-text-blur.ts'
import {getViewportHeight} from '../-utils/viewport.ts'

/** Viewport position where the title starts fading in, by its center. */
const TITLE_ENTER_START_VH = 60

/** Viewport position where the title is fully visible, by its center. */
const TITLE_ENTER_END_VH = 50

/** Extra entrance progress applied to each successive word. */
const TITLE_WORD_STAGGER = 0.07

/** Vertical offset at the start of a word entrance, in pixels. */
const TITLE_WORD_SHIFT_PX = 16

/** Blur at the start of a word entrance, in pixels. */
const TITLE_WORD_BLUR_PX = 6

/**
 * Viewport position where the description starts fading in, by the header
 * center. It starts as the last title word lands, so the handoff has no
 * empty beat while still waiting for the title.
 */
const TITLE_DESCRIPTION_ENTER_START_VH = 50

/** Viewport position where the description is fully visible, by the header center. */
const TITLE_DESCRIPTION_ENTER_END_VH = 44

/** Vertical offset at the start of the description entrance, in pixels. */
const TITLE_DESCRIPTION_SHIFT_PX = 12

/** Blur at the start of the description entrance, in pixels. */
const TITLE_DESCRIPTION_BLUR_PX = 4

/** How far below the title the first content block starts the exit, in viewport heights. */
const TITLE_EXIT_LEAD_VH = 6

/** Extra progress before the description starts exiting. */
const TITLE_DESCRIPTION_EXIT_DELAY = 0.1

/** Blur at the end of the title exit, in pixels. */
const TITLE_EXIT_BLUR_PX = 5

type StickyHeaderScrollOptions = {
	headerRef: RefObject<HTMLDivElement | null>
}

/**
 * Drive the word-by-word entrance and the approach exit for a sticky section
 * title. The title enters around the viewport center, pins near the top, and
 * fades out just before the first content block reaches it.
 */
export function useStickyHeaderScroll({headerRef}: StickyHeaderScrollOptions) {
	const reduceMotion = useReducedMotion()

	useIsomorphicLayoutEffect(() => {
		const header = headerRef.current
		const content = header?.closest('section')?.querySelector<HTMLElement>('[data-section-content]')

		const probe = header
			?.closest('[data-intro-sections]')
			?.querySelector<HTMLElement>('[data-svh-probe]')

		if (!header || !content) return

		const words = Array.from(header.querySelectorAll<HTMLElement>('[data-header-word]'))
		const description = header.querySelector<HTMLElement>('[data-header-description]')

		let frame = 0
		let lastEnter = -1
		let lastExit = 0
		let lastCenter = Number.NaN

		const update = () => {
			frame = 0

			/** Use the same viewport probe as the rest of the intro so mobile chrome does not shift thresholds. */
			const viewport = getViewportHeight(probe ?? null)

			if (viewport <= 0) return

			const headerRect = header.getBoundingClientRect()
			const contentRect = content.getBoundingClientRect()

			/**
			 * Lift the title by the full exit band so it releases with the scroll
			 * while it fades instead of disappearing while still pinned.
			 */
			const exitShiftPx = (TITLE_EXIT_LEAD_VH / 100) * viewport

			/** Remove the exit transform so it does not feed back into the geometry. */
			const appliedShiftPx = reduceMotion ? 0 : -lastExit * exitShiftPx
			const layoutTop = headerRect.top - appliedShiftPx
			const layoutBottom = headerRect.bottom - appliedShiftPx
			const centerVh = ((layoutTop + headerRect.height / 2) / viewport) * 100

			const enterRaw = clamp01(
				(TITLE_ENTER_START_VH - centerVh) / (TITLE_ENTER_START_VH - TITLE_ENTER_END_VH),
			)

			const headerBottomVh = (layoutBottom / viewport) * 100
			const contentTopVh = (contentRect.top / viewport) * 100
			const gapVh = contentTopVh - headerBottomVh
			const exitBandVh = Math.max(TITLE_EXIT_LEAD_VH, 0.001)

			/**
			 * The lift and fade both track the scroll one-to-one so the title
			 * releases with the page instead of lingering at the top and jumping.
			 */
			const exit = clamp01((TITLE_EXIT_LEAD_VH - gapVh) / exitBandVh)

			/**
			 * The description has a later entrance window than the title, so the
			 * center keeps updates flowing after the title has fully landed.
			 */
			if (enterRaw === lastEnter && exit === lastExit && centerVh === lastCenter) return

			lastEnter = enterRaw
			lastExit = exit
			lastCenter = centerVh

			for (let index = 0; index < words.length; index += 1) {
				const word = words[index]

				if (!word) continue

				const offset = reduceMotion ? 0 : index * TITLE_WORD_STAGGER
				const rawProgress = clamp01((enterRaw - offset) / (1 - offset))
				const progress = easeOut(rawProgress)

				word.style.opacity = `${progress * (1 - exit)}`
				word.style.transform = reduceMotion
					? ''
					: `translateY(${(1 - progress) * TITLE_WORD_SHIFT_PX}px)`
				word.style.filter =
					reduceMotion || !supportsTextBlur || progress === 1
						? ''
						: `blur(${(1 - progress) * TITLE_WORD_BLUR_PX}px)`
			}

			if (description) {
				const rawProgress = clamp01(
					(TITLE_DESCRIPTION_ENTER_START_VH - centerVh) /
						(TITLE_DESCRIPTION_ENTER_START_VH - TITLE_DESCRIPTION_ENTER_END_VH),
				)

				const progress = easeOut(rawProgress)

				const descriptionExit = clamp01(
					(exit - TITLE_DESCRIPTION_EXIT_DELAY) / (1 - TITLE_DESCRIPTION_EXIT_DELAY),
				)

				description.style.opacity = `${progress * (1 - descriptionExit)}`
				description.style.transform = reduceMotion
					? ''
					: `translateY(${(1 - progress) * TITLE_DESCRIPTION_SHIFT_PX}px)`
				description.style.filter =
					reduceMotion || !supportsTextBlur || progress === 1
						? ''
						: `blur(${(1 - progress) * TITLE_DESCRIPTION_BLUR_PX}px)`
			}

			header.style.transform = reduceMotion ? '' : `translateY(${-exit * exitShiftPx}px)`
			header.style.filter =
				reduceMotion || !supportsTextBlur || exit === 0
					? ''
					: `blur(${exit * TITLE_EXIT_BLUR_PX}px)`
			header.style.pointerEvents = enterRaw < 0.05 || exit > 0.05 ? 'none' : ''
		}

		const schedule = () => {
			if (frame) return

			frame = requestAnimationFrame(update)
		}

		update()
		window.addEventListener('scroll', schedule, {passive: true})
		window.addEventListener('resize', schedule)

		const resizeObserver = new ResizeObserver(schedule)
		resizeObserver.observe(header)
		resizeObserver.observe(content)

		return () => {
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			resizeObserver.disconnect()

			if (frame) cancelAnimationFrame(frame)
		}
	}, [headerRef, reduceMotion])
}

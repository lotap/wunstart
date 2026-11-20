import {type RefObject, useRef} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'

import {HERO_WORDS} from '../-content/hero.ts'
import {CTA_EXIT_START_VIEWPORTS} from '../-utils/cta.ts'
import {easeOut} from '../-utils/ease.ts'
import {
	BOXES_BLOCK_TOP_VH,
	FEATURES_TEXT_BLOCK_TOP_VH,
	FEATURES_TEXT_IN_VH,
	FEATURES_TEXT_STICKY_TOP_VH,
	FIRST_WORD_VH,
	HEADLINE_FADE_VH,
	MOBILE_MAX_WIDTH_PX,
	PROMPT_FADE_VH,
	RUNWAY_VH,
	SCROLL_PER_WORD_VH,
	SHADER_RELEASE_LEAD_VH,
	SHADER_STICKY_HEIGHT_VH,
	SHADER_STICKY_TOP_VH,
	STICKY_TOP_VH,
	WORD_MAPPING_DISTANCE_VH,
} from '../-utils/hero-layout.ts'
import {clamp, clamp01} from '../-utils/math.ts'
import {supportsTextBlur} from '../-utils/supports-text-blur.ts'
import {getViewportHeight} from '../-utils/viewport.ts'

/** Viewport position where a feature box begins fading in, in viewport heights. */
const BOX_FADE_START_VH = 100

/** Viewport position where a feature box is fully visible, in viewport heights. */
const BOX_FADE_END_VH = 60

/** Blur at the end of the features text exit, in pixels. */
const SUBLINE_EXIT_BLUR_PX = 5

/** Extra upward shift at the end of the features text exit, in pixels. */
const SUBLINE_EXIT_SHIFT_PX = 24

/** Viewport position where a feature box begins fading out, in viewport heights. */
const BOX_EXIT_START_VH = 10

/** Viewport position where a feature box’s bottom is fully gone, in viewport heights. */
const BOX_EXIT_END_BOTTOM_VH = 0

/** Blur at the end of the feature boxes exit, in pixels. */
const BOX_EXIT_BLUR_PX = 4

/** Extra upward shift at the end of the feature boxes exit, in pixels. */
const BOX_EXIT_SHIFT_PX = 24

/** Extra headline progress applied to each successive part. */
const HEADLINE_PART_STAGGER = 0.12

/** Blur at the end of the headline fade, in pixels. */
const HEADLINE_EXIT_BLUR_PX = 5

/** Extra upward shift at the end of the headline fade, in pixels. */
const HEADLINE_EXIT_SHIFT_PX = 24

/** Top offset where the hero nav docks below the viewport edge, in pixels. */
const NAV_STICKY_TOP_PX = 16

/**
 * Gap below the pinned subline. Twice the dock offset so the visual gap clears
 * the subline’s descenders, which overflow its line box.
 */
const NAV_SUBLINE_GAP_PX = NAV_STICKY_TOP_PX * 2

/** Viewport top band where the subline counts as pinned for the nav hold. */
const NAV_SUBLINE_PINNED_VH = 20

/** Lead below the held nav where the first card releases the nav, in viewport heights. */
const NAV_RELEASE_LEAD_VH = 4

/** Portion of the nav release band used by the subline exit. */
const SUBLINE_EXIT_PORTION = 0.7

/** Extra subline entrance progress applied to each successive word. */
const SUBLINE_WORD_STAGGER = 0.07

/** Blur at the start of the subline entrance, in pixels. */
const SUBLINE_BLUR_PX = 6

/** Vertical offset at the start of the subline entrance, in pixels. */
const SUBLINE_SHIFT_PX = 16

/** Vertical offset at the start of the feature boxes entrance, in pixels. */
const BOXES_SHIFT_PX = 24

type GrowNextScrollOptions = {
	sectionRef: RefObject<HTMLElement | null>
	svhProbeRef: RefObject<HTMLDivElement | null>
	shaderParentRef: RefObject<HTMLDivElement | null>
	headlineRef: RefObject<HTMLHeadingElement | null>
	headlineLeadRef: RefObject<HTMLSpanElement | null>
	slotRef: RefObject<HTMLSpanElement | null>
	headlineTailRef: RefObject<HTMLSpanElement | null>
	promptRef: RefObject<HTMLDivElement | null>
	navRef: RefObject<HTMLElement | null>
	navSlotRef: RefObject<HTMLDivElement | null>
	navDockRef: RefObject<HTMLDivElement | null>
	sublineRef: RefObject<HTMLParagraphElement | null>
	sublineWordRefs: RefObject<Array<HTMLSpanElement | null>>
	boxesBlockRef: RefObject<HTMLDivElement | null>
	scrimRef: RefObject<HTMLDivElement | null>
	cardRefs: RefObject<Array<HTMLLIElement | null>>
	reduceMotion: boolean
	onActiveIndexChange: (index: number) => void
}

/**
 * Drive the word index and scroll-linked reveal styles for the intro
 * composition. Geometry is cached on layout changes; the scroll path only
 * reads the section rect before writing styles.
 */
export function useGrowNextScroll({
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
	navDockRef,
	sublineRef,
	sublineWordRefs,
	boxesBlockRef,
	scrimRef,
	cardRefs,
	reduceMotion,
	onActiveIndexChange,
}: GrowNextScrollOptions) {
	const lastHeadlineFade = useRef(-1)
	const lastPromptFade = useRef(-1)
	const lastFeaturesText = useRef(-1)
	const lastFeaturesTextExit = useRef(-1)
	const lastCardProgress = useRef<number[]>([])
	const lastCardExit = useRef<number[]>([])
	const lastScrimStop = useRef(-1)

	// oxlint-disable-next-line react-hooks-js/immutability
	useIsomorphicLayoutEffect(() => {
		const section = sectionRef.current

		if (!section) return

		lastHeadlineFade.current = -1
		lastPromptFade.current = -1
		lastFeaturesText.current = -1
		lastFeaturesTextExit.current = -1
		lastCardProgress.current = []
		lastCardExit.current = []
		lastScrimStop.current = -1

		let frame = 0
		let currentIndex = -1
		let lastNavTop = Number.NaN
		let navTimeline: Animation | null = null

		/** Scroll range where the nav holds at its docked position. */
		let navDockStart = Number.POSITIVE_INFINITY
		let navDockEnd = Number.POSITIVE_INFINITY

		type LayoutMetrics = {
			blockTop: number
			cardOffsets: number[]
			cardHeights: number[]
			textHeight: number
			lastCardOffset: number
		}

		let layout: LayoutMetrics | null = null

		/**
		 * Read the svh reference from a 1svh probe so the section can grow with
		 * the feature stack without losing the viewport-height scale.
		 */
		const getViewport = () => getViewportHeight(svhProbeRef.current)

		/** Cache document-relative geometry so the scroll path only reads rects. */
		const measureLayout = () => {
			const boxesBlock = boxesBlockRef.current
			const cardOffsets: number[] = []
			const cardHeights: number[] = []

			// oxlint-disable-next-line react/immutability react-hooks-js/immutability
			for (let index = 0; index < cardRefs.current.length; index += 1) {
				const card = cardRefs.current[index]
				cardOffsets.push(card?.offsetTop ?? 0)
				cardHeights.push(card?.offsetHeight ?? 0)
			}

			layout = {
				blockTop: boxesBlock?.offsetTop ?? 0,
				cardOffsets,
				cardHeights,
				textHeight: sublineRef.current?.offsetHeight ?? 0,
				lastCardOffset: cardOffsets[cardOffsets.length - 1] ?? 0,
			}

			/**
			 * Release the shader as the first card reaches the subline handoff:
			 * the parent ends at the shader release line.
			 */
			const viewport = getViewport()

			if (viewport <= 0 || !shaderParentRef.current) return

			const textHeightVh = (layout.textHeight / viewport) * 100

			const shaderReleaseStartVh =
				FEATURES_TEXT_STICKY_TOP_VH + textHeightVh + SHADER_RELEASE_LEAD_VH

			const shaderParentHeightVh =
				BOXES_BLOCK_TOP_VH - shaderReleaseStartVh + SHADER_STICKY_TOP_VH + SHADER_STICKY_HEIGHT_VH

			shaderParentRef.current.style.height = `${shaderParentHeightVh}svh`
		}

		/**
		 * Drive the nav with a scroll timeline instead of scroll events. The nav
		 * holds at the hero bottom, rides the headline release, waits below the
		 * subline, then docks. A scroll-driven animation stays in step with
		 * momentum scrolling, where a scroll handler visibly lags on iOS.
		 */
		const buildNavTimeline = () => {
			const nav = navRef.current
			const navSlot = navSlotRef.current
			const subline = sublineRef.current
			const layer = section.querySelector<HTMLElement>('[data-headline-layer]')

			if (!nav) return

			if (typeof ScrollTimeline === 'undefined' || !navSlot || !subline || !layer) return

			const viewport = getViewport()

			if (viewport <= 0 || !layout) return

			const sectionTop = section.getBoundingClientRect().top + window.scrollY
			const sectionBottom = sectionTop + section.offsetHeight
			const layerHeight = layer.offsetHeight
			const navHeight = nav.offsetHeight
			const slotBottom = navSlot.offsetTop + navSlot.offsetHeight
			const stickyTop = (STICKY_TOP_VH / 100) * viewport

			const holdTop =
				(FEATURES_TEXT_STICKY_TOP_VH / 100) * viewport + subline.offsetHeight + NAV_SUBLINE_GAP_PX

			const releaseStart = holdTop + navHeight + (NAV_RELEASE_LEAD_VH / 100) * viewport
			const releaseTravel = Math.max(holdTop - NAV_STICKY_TOP_PX, 0)
			const firstCardTop = sectionTop + layout.blockTop + (layout.cardOffsets[0] ?? 0)

			/** The nav’s viewport top while the headline layer is pinned. */
			const restingTop = Math.min(stickyTop, sectionBottom - layerHeight) + slotBottom - navHeight

			/** Scroll position where the headline layer starts moving up. */
			const layerRelease = sectionBottom - layerHeight - stickyTop

			/** Scroll position where the held nav reaches the subline gap. */
			const reachHold = layerRelease + Math.max(restingTop - holdTop, 0)

			/** Scroll position where the first card releases the nav from the gap. */
			const releaseAt = Math.max(firstCardTop - releaseStart, reachHold)
			const releaseEnd = releaseAt + releaseTravel

			if (releaseEnd <= 0) return

			/**
			 * The nav stays docked until the closing CTA itself starts moving up.
			 * On desktop the stage is sticky, so that happens when its containing
			 * block releases it, not when the exit fade begins. Then the nav slides
			 * out at scroll speed like a static element.
			 */
			const ctaSection = document.getElementById('get-started')

			const ctaStage = ctaSection?.querySelector<HTMLElement>('[data-cta-stage]')
			const ctaStageParent = ctaStage?.parentElement

			const ctaStageRelease =
				ctaStage && ctaStageParent && getComputedStyle(ctaStage).position === 'sticky'
					? ctaStageParent.getBoundingClientRect().bottom + window.scrollY - ctaStage.offsetHeight
					: null

			const ctaExitStart = ctaSection
				? ctaSection.getBoundingClientRect().bottom +
					window.scrollY -
					viewport * CTA_EXIT_START_VIEWPORTS
				: null

			const navRelease = ctaStageRelease ?? ctaExitStart

			const navExitStart = navRelease === null ? null : Math.max(navRelease, releaseEnd)

			const navExitEnd =
				navExitStart === null ? releaseEnd : navExitStart + navHeight + NAV_STICKY_TOP_PX

			const at = (scroll: number, top: number): Keyframe => ({
				offset: clamp01(scroll / navExitEnd),
				transform: `translate3d(0, ${top}px, 0)`,
			})

			const dock = navDockRef.current

			if (dock) dock.dataset['ready'] = 'true'

			navDockStart = releaseEnd
			navDockEnd = navExitStart ?? Number.POSITIVE_INFINITY
			navTimeline?.cancel()

			const keyframes = [
				at(0, restingTop),
				at(layerRelease, restingTop),
				at(reachHold, holdTop),
				at(releaseAt, holdTop),
				at(releaseEnd, NAV_STICKY_TOP_PX),
			]

			if (navExitStart !== null) {
				keyframes.push(at(navExitStart, NAV_STICKY_TOP_PX))
				keyframes.push(at(navExitEnd, -navHeight))
			}

			try {
				navTimeline = nav.animate(keyframes, {
					easing: 'linear',
					fill: 'both',
					timeline: new ScrollTimeline({source: document.documentElement, axis: 'block'}),
					rangeStart: '0px',
					rangeEnd: `${navExitEnd}px`,
				})
			} catch {
				navTimeline = null
				nav.style.transform = `translate3d(0, ${restingTop}px, 0)`
			}
		}

		const getIndex = (rect: DOMRect, viewport: number) => {
			const start = (STICKY_TOP_VH / 100) * viewport
			const distance = (WORD_MAPPING_DISTANCE_VH / 100) * viewport

			if (distance <= 0) return 0

			const scrolled = clamp(start - rect.top, 0, distance)
			const positionVh = (scrolled / distance) * RUNWAY_VH

			if (positionVh < FIRST_WORD_VH) return 0

			return Math.min(
				Math.floor((positionVh - FIRST_WORD_VH) / SCROLL_PER_WORD_VH) + 1,
				HERO_WORDS.length - 1,
			)
		}

		/** Document scroll position where a headline word after the first becomes active. */
		const wordScrollTop = (index: number, rect: DOMRect, viewport: number) => {
			const positionVh = FIRST_WORD_VH + (index - 1) * SCROLL_PER_WORD_VH

			return (
				rect.top +
				window.scrollY -
				(STICKY_TOP_VH / 100) * viewport +
				(positionVh / RUNWAY_VH) * (WORD_MAPPING_DISTANCE_VH / 100) * viewport
			)
		}

		const updateScrollStyles = (rect: DOMRect, viewport: number) => {
			if (!layout) return

			const dock = navDockRef.current

			if (dock) {
				const docked = window.scrollY >= navDockStart && window.scrollY < navDockEnd

				if (dock.dataset['docked'] !== String(docked)) dock.dataset['docked'] = String(docked)
			}

			const subline = sublineRef.current
			const sublineRect = subline?.getBoundingClientRect()

			const sublinePinned = sublineRect
				? sublineRect.top <= viewport * (NAV_SUBLINE_PINNED_VH / 100)
				: false

			const sublineTop = sublinePinned
				? (FEATURES_TEXT_STICKY_TOP_VH / 100) * viewport
				: (sublineRect?.top ?? 0)

			const sublineBottom = sublineTop + (subline?.offsetHeight ?? 0)
			const firstCardTopPx = rect.top + layout.blockTop + (layout.cardOffsets[0] ?? 0)

			const nav = navRef.current
			const navSlot = navSlotRef.current
			const holdTop = sublineRect ? sublineBottom + NAV_SUBLINE_GAP_PX : null

			const releaseStart =
				holdTop !== null && nav
					? holdTop + nav.offsetHeight + (NAV_RELEASE_LEAD_VH / 100) * viewport
					: null

			/**
			 * Once the first card reaches the release lead, the nav lifts at the
			 * same rate as the page scroll until it docks at the top edge.
			 */
			const releaseTravel = holdTop !== null ? Math.max(holdTop - NAV_STICKY_TOP_PX, 0) : 0

			const releaseOffset =
				releaseStart !== null
					? Math.min(Math.max(releaseStart - firstCardTopPx, 0), releaseTravel)
					: 0

			const releaseProgress = releaseTravel > 0 ? releaseOffset / releaseTravel : 0

			if (nav && navSlot) {
				const baseTop = navSlot.getBoundingClientRect().bottom - nav.offsetHeight

				const heldTop = holdTop !== null && sublinePinned ? Math.max(baseTop, holdTop) : baseTop

				const navTop = releaseOffset > 0 && holdTop !== null ? holdTop - releaseOffset : heldTop

				/** Tracked with a composited transform so iOS momentum scroll does not jitter. */
				if (dock && dock.dataset['ready'] !== 'true') dock.dataset['ready'] = 'true'

				if (!navTimeline) {
					/** Same dock edge as the timeline’s `releaseEnd`, in scroll coordinates. */
					navDockStart =
						releaseStart === null
							? Number.POSITIVE_INFINITY
							: window.scrollY + firstCardTopPx - releaseStart + releaseTravel
					navDockEnd = Number.POSITIVE_INFINITY
				}

				/** The scroll-driven animation handles this path where it is supported. */
				if (!navTimeline && navTop !== lastNavTop) {
					lastNavTop = navTop
					nav.style.transform = `translate3d(0, ${navTop}px, 0)`
				}
			}

			const sectionHeightVh = (rect.height / viewport) * 100
			const sectionBottomVh = (rect.bottom / viewport) * 100
			const headlineStickyBottomVh = STICKY_TOP_VH + sectionHeightVh - WORD_MAPPING_DISTANCE_VH
			const featuresTextEndBottomVh = headlineStickyBottomVh - FEATURES_TEXT_IN_VH

			const featuresTextProgress = clamp01(
				(headlineStickyBottomVh - sectionBottomVh) / FEATURES_TEXT_IN_VH,
			)

			const headlineFadeProgress = clamp01(
				(featuresTextEndBottomVh - sectionBottomVh) / HEADLINE_FADE_VH,
			)

			/**
			 * Desktop keeps the prompt until the subline pins. On mobile it exits
			 * from the last word change, with a short overlap as the subline comes
			 * in.
			 */
			const compact = window.innerWidth < MOBILE_MAX_WIDTH_PX

			const promptFadeStart = compact
				? wordScrollTop(HERO_WORDS.length - 1, rect, viewport)
				: rect.top +
					window.scrollY +
					((FEATURES_TEXT_BLOCK_TOP_VH - FEATURES_TEXT_STICKY_TOP_VH) / 100) * viewport

			const promptFadeDistance = (PROMPT_FADE_VH / 100) * viewport

			const promptFadeProgress =
				promptFadeDistance > 0
					? clamp01((window.scrollY - promptFadeStart) / promptFadeDistance)
					: 0

			if (promptFadeProgress !== lastPromptFade.current) {
				const prompt = promptRef.current

				if (prompt) {
					const promptExit = easeOut(promptFadeProgress)

					prompt.style.opacity = `${1 - promptExit}`

					const interactive = promptExit < 0.5

					prompt.style.pointerEvents = interactive ? '' : 'none'
					prompt.inert = !interactive
				}

				lastPromptFade.current = promptFadeProgress
			}

			const scrimHeight = rect.height - layout.blockTop

			/**
			 * The subline lifts and fades over the first part of the scroll band
			 * that releases the nav from its hold position below the text.
			 */
			const textExitProgress = clamp01(releaseProgress / SUBLINE_EXIT_PORTION)
			const featuresTextExit = easeOut(textExitProgress)
			const textExitLiftPx = featuresTextExit * SUBLINE_EXIT_SHIFT_PX

			if (headlineFadeProgress !== lastHeadlineFade.current) {
				const headline = headlineRef.current

				if (headline) {
					headline.style.filter =
						reduceMotion || !supportsTextBlur || headlineFadeProgress === 0
							? ''
							: `blur(${headlineFadeProgress * HEADLINE_EXIT_BLUR_PX}px)`
				}

				const headlineParts = [
					{element: headlineLeadRef.current, offset: 0},
					{element: slotRef.current, offset: HEADLINE_PART_STAGGER},
					{element: headlineTailRef.current, offset: HEADLINE_PART_STAGGER * 2},
				]

				for (const {element, offset: partOffset} of headlineParts) {
					if (!element) continue

					const offset = reduceMotion ? 0 : partOffset

					const rawProgress = clamp01((headlineFadeProgress - offset) / (1 - offset))

					const partProgress = easeOut(rawProgress)

					element.style.opacity = `${1 - partProgress}`
					element.style.transform = reduceMotion
						? ''
						: `translateY(${partProgress * -HEADLINE_EXIT_SHIFT_PX}px)`
				}

				lastHeadlineFade.current = headlineFadeProgress
			}

			if (
				featuresTextProgress !== lastFeaturesText.current ||
				featuresTextExit !== lastFeaturesTextExit.current
			) {
				if (subline) {
					subline.style.filter =
						reduceMotion ||
						!supportsTextBlur ||
						(featuresTextProgress >= 1 && featuresTextExit === 0)
							? ''
							: `blur(${(1 - featuresTextProgress) * SUBLINE_BLUR_PX + featuresTextExit * SUBLINE_EXIT_BLUR_PX}px)`
					subline.style.transform =
						reduceMotion || textExitLiftPx === 0 ? '' : `translateY(-${textExitLiftPx}px)`
					subline.style.pointerEvents = featuresTextExit > 0.05 ? 'none' : ''
				}

				// oxlint-disable-next-line react/immutability react-hooks-js/immutability
				for (let index = 0; index < sublineWordRefs.current.length; index += 1) {
					const element = sublineWordRefs.current[index]

					if (!element) continue

					const offset = reduceMotion ? 0 : index * SUBLINE_WORD_STAGGER

					const rawProgress = clamp01((featuresTextProgress - offset) / (1 - offset))

					const wordProgress = easeOut(rawProgress)
					const wordExit = featuresTextExit

					element.style.opacity = `${wordProgress * (1 - wordExit)}`
					element.style.transform = reduceMotion
						? ''
						: `translateY(${(1 - wordProgress) * SUBLINE_SHIFT_PX - wordExit * SUBLINE_EXIT_SHIFT_PX}px)`
				}

				lastFeaturesText.current = featuresTextProgress
				lastFeaturesTextExit.current = featuresTextExit
			}

			const scrim = scrimRef.current

			if (scrim && scrimHeight > 0) {
				const stop = (layout.lastCardOffset / scrimHeight) * 100

				if (stop !== lastScrimStop.current) {
					scrim.style.setProperty('--scrim-stop', `${stop}%`)
					lastScrimStop.current = stop
				}
			}

			// oxlint-disable-next-line react/immutability react-hooks-js/immutability
			for (let index = 0; index < cardRefs.current.length; index += 1) {
				const card = cardRefs.current[index]

				if (!card) continue

				const cardTopVh =
					((rect.top + layout.blockTop + (layout.cardOffsets[index] ?? 0)) / viewport) * 100

				const cardHeightVh = ((layout.cardHeights[index] ?? 0) / viewport) * 100

				const rawProgress = clamp01(
					(BOX_FADE_START_VH - cardTopVh) / (BOX_FADE_START_VH - BOX_FADE_END_VH),
				)

				const cardProgress = easeOut(rawProgress)

				// A card is gone once its bottom crosses the viewport top.
				const exitRawProgress = clamp01(
					(BOX_EXIT_START_VH - cardTopVh) /
						(BOX_EXIT_START_VH - BOX_EXIT_END_BOTTOM_VH + cardHeightVh),
				)

				const cardExit = easeOut(exitRawProgress)

				if (
					cardProgress === lastCardProgress.current[index] &&
					cardExit === lastCardExit.current[index]
				) {
					continue
				}

				card.style.opacity = `${cardProgress * (1 - cardExit)}`
				card.style.transform = reduceMotion
					? ''
					: `translateY(${(1 - cardProgress) * BOXES_SHIFT_PX - cardExit * BOX_EXIT_SHIFT_PX}px)`
				card.style.filter =
					reduceMotion || !supportsTextBlur || cardExit === 0
						? ''
						: `blur(${cardExit * BOX_EXIT_BLUR_PX}px)`

				lastCardProgress.current[index] = cardProgress
				lastCardExit.current[index] = cardExit
			}
		}

		const update = () => {
			frame = 0
			const rect = section.getBoundingClientRect()
			const viewport = getViewport()
			const nextIndex = getIndex(rect, viewport)

			updateScrollStyles(rect, viewport)

			if (nextIndex === currentIndex) return

			currentIndex = nextIndex
			onActiveIndexChange(nextIndex)
		}

		const onScroll = () => {
			if (frame) return
			frame = requestAnimationFrame(update)
		}

		const onResize = () => {
			measureLayout()
			buildNavTimeline()
			onScroll()
		}

		measureLayout()
		buildNavTimeline()

		const initialRect = section.getBoundingClientRect()
		const initialViewport = getViewport()
		currentIndex = getIndex(initialRect, initialViewport)
		updateScrollStyles(initialRect, initialViewport)
		onActiveIndexChange(currentIndex)

		window.addEventListener('scroll', onScroll, {passive: true})
		window.addEventListener('resize', onResize)

		const resizeObserver = new ResizeObserver(onResize)
		resizeObserver.observe(section)

		if (boxesBlockRef.current) resizeObserver.observe(boxesBlockRef.current)

		if (sublineRef.current) resizeObserver.observe(sublineRef.current)

		return () => {
			window.removeEventListener('scroll', onScroll)
			window.removeEventListener('resize', onResize)
			resizeObserver.disconnect()
			navTimeline?.cancel()

			if (frame) cancelAnimationFrame(frame)
		}
	}, [
		boxesBlockRef,
		cardRefs,
		headlineLeadRef,
		headlineRef,
		headlineTailRef,
		navRef,
		navSlotRef,
		navDockRef,
		onActiveIndexChange,
		reduceMotion,
		scrimRef,
		sectionRef,
		shaderParentRef,
		slotRef,
		sublineRef,
		sublineWordRefs,
		svhProbeRef,
	])
}

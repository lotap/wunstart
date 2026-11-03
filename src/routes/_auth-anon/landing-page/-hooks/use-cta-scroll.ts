import {type RefObject} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

import {CTA_EXIT_START_VIEWPORTS} from '../-utils/cta.ts'
import {easeOut} from '../-utils/ease.ts'
import {clamp01, progressDiffers} from '../-utils/math.ts'
import {supportsTextBlur} from '../-utils/supports-text-blur.ts'
import {getViewportHeight} from '../-utils/viewport.ts'

/** How far below the tagline the first panel starts the mobile exit, in viewport heights. */
const TAGLINE_PUSH_LEAD_VH = 14

/** Gap where the mobile tagline exit finishes, in viewport heights. */
const TAGLINE_PUSH_END_GAP_VH = 2

/** Pause between the tagline and the panel entrance on smaller screens, in viewport heights. */
const PANEL_DELAY_VH = 4

/** Pause between the last tagline line and the panel entrance on desktop, in viewport heights. */
const PANEL_DELAY_VH_DESKTOP = 1

/** Scroll distance for the panel entrance, in viewport heights. */
const PANEL_ENTER_VH = 15

/** Scroll distance for the panel entrance on desktop, in viewport heights. */
const PANEL_ENTER_VH_DESKTOP = 18

/** Viewport position where the GitHub panel starts entering, in viewport heights. */
const GITHUB_PANEL_ENTER_START_VH = 100

/** Viewport position where the GitHub panel is fully entered, in viewport heights. */
const GITHUB_PANEL_ENTER_END_VH = 88

/** Fraction of the prompt panel’s entrance to wait before the GitHub panel starts. */
const GITHUB_PANEL_ENTER_DELAY = 0.22

/** Fraction of the prompt panel’s exit to wait before the GitHub panel starts leaving on desktop. */
const GITHUB_PANEL_EXIT_DELAY_DESKTOP = 0.18

/** Fraction of the prompt panel’s exit to wait before the GitHub panel starts leaving on smaller screens. */
const GITHUB_PANEL_EXIT_DELAY_SMALL = 0.45

/** Number of leading tagline lines that form the lead phrase. */
const TAGLINE_LEAD_LINE_COUNT = 3

/** Progress between lead line starts. */
const TAGLINE_LEAD_LINE_STEP = 0.05

/** Entrance window for each lead tagline line. */
const TAGLINE_LEAD_LINE_DURATION = 0.5

/** Progress where the first support tagline line starts. */
const TAGLINE_SUPPORT_LINE_START = 0.3

/** Progress between support line starts. */
const TAGLINE_SUPPORT_LINE_STEP = 0.06

/** Entrance window for each support tagline line; the last one lands at the fill. */
const TAGLINE_SUPPORT_LINE_DURATION = 0.64

/** Vertical lift at the start of a tagline line entrance, in pixels. */
const TAGLINE_LINE_SHIFT_PX = 24

/** Blur at the start of a tagline line entrance, in pixels. */
const TAGLINE_ENTER_BLUR_PX = 6

/** Upward travel of the tagline block during its exit, in pixels. */
const TAGLINE_EXIT_SHIFT_PX = 32

/** Blur at the end of the tagline exit, in pixels. */
const TAGLINE_EXIT_BLUR_PX = 5

/** Horizontal offset at the start of a desktop panel entrance, in pixels. */
const PANEL_ENTER_X_PX = 20

/** Vertical offset at the start of a small-screen panel entrance, in pixels. */
const PANEL_ENTER_Y_PX = 16

/** Leftward travel of a desktop panel during its exit, in pixels. */
const PANEL_EXIT_X_PX = 24

/** Upward travel of a small-screen panel during its exit, in pixels. */
const PANEL_EXIT_Y_PX = 20

/** Blur at the end of the panel exit, in pixels. */
const PANEL_EXIT_BLUR_PX = 4

const DESKTOP_QUERY = '(min-width: 1024px)'

type CtaScrollOptions = {
	sectionRef: RefObject<HTMLElement | null>
	shaderFrameRef: RefObject<HTMLElement | null>
	svhProbeRef: RefObject<HTMLElement | null>
	taglineRef: RefObject<HTMLHeadingElement | null>
	lineRefs: RefObject<Array<HTMLSpanElement | null>>
	panelRefs: RefObject<Array<HTMLElement | null>>
}

/**
 * Drive the closing CTA. On desktop the tagline is held at its resting screen
 * position. Once the previous section’s bottom reaches the tagline top, the
 * lines enter top-down in place while the shader finishes filling. On smaller
 * screens the tagline scrolls in, pins near the top, and leaves when the panels
 * push it. The panels enter after the shader fills. Both leave as the footer
 * arrives: the tagline lifts, fades, and blurs like the other headlines, and
 * the panels exit to the left on desktop or normally upward on smaller screens.
 */
export function useCtaScroll({
	sectionRef,
	shaderFrameRef,
	svhProbeRef,
	taglineRef,
	lineRefs,
	panelRefs,
}: CtaScrollOptions) {
	const reduceMotion = useReducedMotion()

	useIsomorphicLayoutEffect(() => {
		const section = sectionRef.current
		const tagline = taglineRef.current

		if (!section || !tagline) return

		const desktopQuery = window.matchMedia(DESKTOP_QUERY)

		let frame = 0
		let lastLineEnters: Array<number> = []
		let lastTaglineExit = -1
		let lastRevealShift = Number.NaN
		let lastShiftPx = 0
		let lastPanelEnters: Array<number> = []
		let lastPanelExits: Array<number> = []
		let appliedPanelY: Array<number> = []
		let lastDesktop = false
		let lastShaderShift = Number.NaN
		let shaderCanvas: HTMLCanvasElement | null = null

		const updateTagline = (lineEnters: Array<number>, exit: number, revealShiftPx: number) => {
			const blockExit = easeOut(exit)
			const shiftPx = reduceMotion ? 0 : revealShiftPx - blockExit * TAGLINE_EXIT_SHIFT_PX

			tagline.style.transform = Math.abs(shiftPx) < 0.001 ? '' : `translateY(${shiftPx}px)`
			tagline.style.pointerEvents = exit > 0.05 ? 'none' : ''

			// oxlint-disable-next-line react/immutability react-hooks-js/immutability
			for (let index = 0; index < lineRefs.current.length; index += 1) {
				const line = lineRefs.current[index]

				if (!line) continue

				const lineEnter = lineEnters[index] ?? 0

				line.style.opacity = `${lineEnter * (1 - blockExit)}`
				line.style.transform = reduceMotion
					? ''
					: `translateY(${(1 - lineEnter) * TAGLINE_LINE_SHIFT_PX}px)`

				const lineBlur = (1 - lineEnter) * TAGLINE_ENTER_BLUR_PX + blockExit * TAGLINE_EXIT_BLUR_PX

				line.style.filter =
					reduceMotion || !supportsTextBlur || lineBlur < 0.001 ? '' : `blur(${lineBlur}px)`
			}

			lastShiftPx = shiftPx
		}

		const updatePanels = (enters: Array<number>, exits: Array<number>, desktop: boolean) => {
			// oxlint-disable-next-line react/immutability react-hooks-js/immutability
			for (let index = 0; index < panelRefs.current.length; index += 1) {
				const panel = panelRefs.current[index]

				if (!panel) continue

				const panelEnter = easeOut(clamp01(enters[index] ?? 0))
				const panelExit = easeOut(clamp01(exits[index] ?? 0))

				const enterX = desktop ? (1 - panelEnter) * PANEL_ENTER_X_PX : 0
				const enterY = desktop ? 0 : (1 - panelEnter) * PANEL_ENTER_Y_PX
				const exitX = desktop ? -panelExit * PANEL_EXIT_X_PX : 0
				const exitY = desktop ? 0 : -panelExit * PANEL_EXIT_Y_PX

				const interactive = panelEnter >= 0.05 && panelExit < 0.8

				panel.style.opacity = `${panelEnter * (1 - panelExit)}`
				panel.style.transform = reduceMotion
					? ''
					: `translate(${enterX + exitX}px, ${enterY + exitY}px)`
				panel.style.filter =
					reduceMotion || !supportsTextBlur || panelExit < 0.001
						? ''
						: `blur(${panelExit * PANEL_EXIT_BLUR_PX}px)`
				panel.style.pointerEvents = interactive ? '' : 'none'
				panel.inert = !interactive

				/** The first panel owns the copy hint; it appears once that panel has finished entering. */
				if (index === 0) {
					panel.dataset['ready'] = panelEnter >= 0.999 ? 'true' : 'false'
					panel.dataset['exiting'] = panelExit > 0 ? 'true' : 'false'
				}

				appliedPanelY[index] = reduceMotion ? 0 : enterY + exitY
			}
		}

		const update = () => {
			frame = 0

			const viewport = getViewportHeight(svhProbeRef.current)

			if (viewport <= 0) return

			const desktop = desktopQuery.matches
			const sectionRect = section.getBoundingClientRect()

			/**
			 * The shader frame moves with the section until it pins. Counter-shift
			 * the canvas by the same distance so the pattern stays fixed to the
			 * viewport and the section edge reveals it like a curtain. Write the
			 * transform directly; a custom property on the frame would recalculate
			 * the subtree on every scroll frame.
			 */
			const shaderShift = Math.max(0, sectionRect.top)

			if (!shaderCanvas || !shaderCanvas.isConnected) {
				shaderCanvas = shaderFrameRef.current?.querySelector('canvas') ?? null
			}

			if (shaderCanvas && shaderShift !== lastShaderShift) {
				shaderCanvas.style.transform = `translate3d(0, ${-shaderShift}px, 0)`
				lastShaderShift = shaderShift
			}

			const lineCount = lineRefs.current.length
			const allLines = Array.from({length: lineCount}, () => 1)
			const panelCount = panelRefs.current.length
			const allPanels = Array.from({length: panelCount}, () => 1)
			const noPanelExits = Array.from({length: panelCount}, () => 0)

			if (reduceMotion) {
				if (
					lastLineEnters.length !== lineCount ||
					lastLineEnters.some((value) => value !== 1) ||
					lastTaglineExit !== 0
				) {
					updateTagline(allLines, 0, 0)
					lastLineEnters = allLines
					lastTaglineExit = 0
					lastRevealShift = 0
				}

				if (
					lastPanelEnters.length !== panelCount ||
					lastPanelEnters.some((value) => value !== 1) ||
					lastPanelExits.length !== panelCount ||
					lastPanelExits.some((value) => value !== 0) ||
					desktop !== lastDesktop
				) {
					updatePanels(allPanels, noPanelExits, desktop)
					lastPanelEnters = allPanels
					lastPanelExits = noPanelExits
					lastDesktop = desktop
				}

				return
			}

			/**
			 * The tagline’s layout top is the screen position it reaches when the
			 * shader fills. Build starts when the previous section’s bottom reaches
			 * that position; the sequence then runs until the fill.
			 */
			const revealShiftPx = desktop ? -Math.max(0, sectionRect.top) : 0
			const taglineRect = tagline.getBoundingClientRect()
			const taglineStartPx = taglineRect.top - lastShiftPx - sectionRect.top

			const taglineEnter =
				taglineStartPx > 0 ? clamp01((taglineStartPx - sectionRect.top) / taglineStartPx) : 0

			const lineEnters: Array<number> = []

			// oxlint-disable-next-line react/immutability react-hooks-js/immutability
			for (let index = 0; index < lineCount; index += 1) {
				const lead = index < TAGLINE_LEAD_LINE_COUNT

				const start = lead
					? index * TAGLINE_LEAD_LINE_STEP
					: TAGLINE_SUPPORT_LINE_START +
						(index - TAGLINE_LEAD_LINE_COUNT) * TAGLINE_SUPPORT_LINE_STEP

				const duration = lead ? TAGLINE_LEAD_LINE_DURATION : TAGLINE_SUPPORT_LINE_DURATION

				lineEnters.push(easeOut(clamp01((taglineEnter - start) / duration)))
			}

			const fillProgressPx = Math.max(0, -sectionRect.top)
			const panelDelayPx = (viewport * (desktop ? PANEL_DELAY_VH_DESKTOP : PANEL_DELAY_VH)) / 100
			const panelEnterPx = (viewport * (desktop ? PANEL_ENTER_VH_DESKTOP : PANEL_ENTER_VH)) / 100
			const panelEnter = clamp01((fillProgressPx - panelDelayPx) / panelEnterPx)

			/** Desktop delays the GitHub panel behind the prompt; mobile uses its own viewport position. */
			let githubEnter: number

			if (desktop) {
				githubEnter = clamp01(
					(panelEnter - GITHUB_PANEL_ENTER_DELAY) / (1 - GITHUB_PANEL_ENTER_DELAY),
				)
			} else {
				const githubPanel = panelRefs.current[1]

				const githubTop = githubPanel
					? githubPanel.getBoundingClientRect().top - (appliedPanelY[1] ?? 0)
					: Number.POSITIVE_INFINITY

				const githubTopVh = (githubTop / viewport) * 100

				githubEnter = clamp01(
					(GITHUB_PANEL_ENTER_START_VH - githubTopVh) /
						(GITHUB_PANEL_ENTER_START_VH - GITHUB_PANEL_ENTER_END_VH),
				)
			}

			const panelEnters = [panelEnter, githubEnter]

			/**
			 * The exit starts just before the CTA bottom reaches the viewport
			 * bottom and finishes as the footer fills the viewport.
			 */
			const exitStart = viewport * CTA_EXIT_START_VIEWPORTS
			const footerExit = clamp01((exitStart - sectionRect.bottom) / exitStart)

			const githubExitDelay = desktop
				? GITHUB_PANEL_EXIT_DELAY_DESKTOP
				: GITHUB_PANEL_EXIT_DELAY_SMALL

			const githubExit = clamp01((footerExit - githubExitDelay) / (1 - githubExitDelay))

			const panelExits = [footerExit, githubExit]

			/** On smaller screens the panels push the pinned tagline out. */
			let pushExit = 0

			const firstPanel = panelRefs.current[0]

			if (!desktop && firstPanel) {
				const panelTop = firstPanel.getBoundingClientRect().top
				const taglineBottom = taglineRect.bottom - lastShiftPx
				const gapPx = panelTop - taglineBottom
				const leadPx = (viewport * TAGLINE_PUSH_LEAD_VH) / 100
				const endPx = (viewport * TAGLINE_PUSH_END_GAP_VH) / 100

				pushExit = clamp01((leadPx - gapPx) / Math.max(leadPx - endPx, 1))
			}

			const taglineExit = desktop ? footerExit : pushExit

			const lineEntersChanged = progressDiffers(lineEnters, lastLineEnters)

			const shiftChanged = Math.abs(revealShiftPx - lastRevealShift) > 0.1
			const exitChanged = Math.abs(taglineExit - lastTaglineExit) > 0.001

			if (lineEntersChanged || shiftChanged || exitChanged) {
				updateTagline(lineEnters, taglineExit, revealShiftPx)
				lastLineEnters = lineEnters
				lastTaglineExit = taglineExit
				lastRevealShift = revealShiftPx
			}

			const panelEntersChanged = progressDiffers(panelEnters, lastPanelEnters)
			const panelExitsChanged = progressDiffers(panelExits, lastPanelExits)

			if (panelEntersChanged || panelExitsChanged || desktop !== lastDesktop) {
				updatePanels(panelEnters, panelExits, desktop)
				lastPanelEnters = panelEnters
				lastPanelExits = panelExits
				lastDesktop = desktop
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
		resizeObserver.observe(section)

		return () => {
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			resizeObserver.disconnect()

			if (frame) cancelAnimationFrame(frame)
		}
	}, [lineRefs, panelRefs, reduceMotion, sectionRef, shaderFrameRef, svhProbeRef, taglineRef])
}

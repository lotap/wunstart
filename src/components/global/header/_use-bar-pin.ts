import {type RefObject, useRef} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'

/**
 * The bar’s visible height in pixels, published on the root for fixed or
 * sticky chrome that has to sit below it. While the bar is out of flow the
 * value tracks its visible bottom (0 once it is fully out), so a consumer
 * follows the bar instead of jumping back to the viewport edge.
 */
const DOCK_VAR = '--header-dock'

/** Duration of the dock offset; nonzero only while the bar animates in. */
const DOCK_MOTION_VAR = '--header-dock-transition'

/** Set by a programmatic scroll that must not reveal the bar; cleared on `scrollend`. */
const HOLD_ATTR = 'data-hold-pin'

/** Matches the bar’s enter and exit animations. */
const BAR_MOTION_MS = 150

/** Animate bar motion only when the user has not asked for less motion. */
function shouldAnimateBar(animate: boolean) {
	return animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type BarPinOptions = {
	/** The bar that leaves the flow while pinned. */
	barRef: RefObject<HTMLDivElement | null>
	/** The in-flow element that reserves the bar’s height. */
	slotRef: RefObject<HTMLElement | null>
}

/**
 * Keep the bar in flow until it scrolls out, then pin it to the viewport top
 * when the user scrolls back up. A released bar re-enters only once it is
 * fully out or fully back in view, so a half-visible bar never jumps while the
 * page is still scrolling through it. Publishes `--header-dock` and
 * `--header-dock-transition` for chrome that sits below the bar.
 */
export function useBarPin({barRef, slotRef}: BarPinOptions) {
	const lastScrollY = useRef(0)
	const pinned = useRef(false)

	useIsomorphicLayoutEffect(() => {
		const bar = barRef.current
		const slot = slotRef.current

		if (!bar || !slot) return

		const root = document.documentElement
		let frame = 0
		let dismissTimer = 0
		let dockPx = Number.NaN
		let dockMotion = Number.NaN

		/**
		 * Publish how much of the bar still covers the viewport top. A consumer
		 * reads it as its own top offset, so it tracks the bar while it scrolls
		 * away and only transitions when the bar animates in.
		 */
		const applyDock = (bottom: number, motion: number) => {
			const offset = Math.round(Math.min(Math.max(bottom, 0), bar.offsetHeight))

			if (offset !== dockPx) {
				root.style.setProperty(DOCK_VAR, `${offset}px`)
				dockPx = offset
			}

			if (motion !== dockMotion) {
				root.style.setProperty(DOCK_MOTION_VAR, `${motion}ms`)
				dockMotion = motion
			}
		}

		/** Hand the bar back to the page at the scroll offset it was pinned from. */
		const release = (scrollY: number) => {
			const slotTop = slot.getBoundingClientRect().top + window.scrollY

			bar.removeAttribute('data-reveal')
			bar.style.position = 'absolute'
			bar.style.top = `${Math.max(scrollY - slotTop, 0)}px`
			applyDock(bar.getBoundingClientRect().bottom, 0)
			pinned.current = false
		}

		const pin = (reveal: boolean) => {
			const animate = shouldAnimateBar(reveal)

			bar.style.position = 'fixed'
			bar.style.top = '0px'
			applyDock(bar.offsetHeight, animate ? BAR_MOTION_MS : 0)
			bar.toggleAttribute('data-reveal', animate)
			pinned.current = true
		}

		const update = () => {
			const scrollY = window.scrollY
			const last = lastScrollY.current

			if (bar.hasAttribute(HOLD_ATTR)) {
				if (pinned.current) {
					/** A held selection always leaves the bar out of view, not just unpinned. */
					pinned.current = false
					bar.removeAttribute('data-reveal')
					window.clearTimeout(dismissTimer)

					if (shouldAnimateBar(true)) {
						bar.setAttribute('data-dismiss', '')
						applyDock(0, BAR_MOTION_MS)

						// Park the bar once the slide-out has finished; it is fixed at the top meanwhile.
						dismissTimer = window.setTimeout(() => {
							bar.removeAttribute('data-dismiss')
							bar.style.position = 'fixed'
							bar.style.top = `${-bar.offsetHeight}px`
						}, BAR_MOTION_MS)
					} else {
						bar.removeAttribute('data-dismiss')
						bar.style.position = 'fixed'
						bar.style.top = `${-bar.offsetHeight}px`
						applyDock(0, 0)
					}
				}

				lastScrollY.current = scrollY

				return
			}

			if (Math.abs(scrollY - last) > window.innerHeight) {
				/** A route change or anchor jump: show the bar where it lands. */
				if (!pinned.current) pin(false)
			} else if (scrollY <= 0) {
				if (!pinned.current && bar.style.top !== '0px') release(0)
			} else if (pinned.current) {
				if (scrollY > last) release(last)
			} else if (scrollY !== last) {
				const rect = bar.getBoundingClientRect()

				if (scrollY < last && rect.bottom <= 0) pin(true)
				else if (scrollY < last && rect.top >= 0) pin(false)
				else applyDock(rect.bottom, 0)
			}

			lastScrollY.current = scrollY
		}

		const schedule = () => {
			if (frame) return

			frame = requestAnimationFrame(() => {
				frame = 0
				update()
			})
		}

		const resizeObserver = new ResizeObserver(() => {
			/** Keep the published height current across breakpoints. */
			if (pinned.current) applyDock(bar.offsetHeight, dockMotion)
		})

		lastScrollY.current = window.scrollY

		/** Loaded mid-page, or with a fragment: start pinned so the bar is reachable. */
		if (window.scrollY > 0) pin(false)

		resizeObserver.observe(bar)
		window.addEventListener('scroll', schedule, {passive: true})

		return () => {
			window.removeEventListener('scroll', schedule)
			resizeObserver.disconnect()
			root.style.removeProperty(DOCK_VAR)
			root.style.removeProperty(DOCK_MOTION_VAR)

			window.clearTimeout(dismissTimer)

			if (frame) cancelAnimationFrame(frame)
		}
	}, [barRef, slotRef])
}

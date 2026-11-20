import {type RefObject, useRef} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'

/**
 * Height of the pinned bar, so the landing section dock can sit below it. While
 * the bar is out of flow this tracks its visible bottom, so the dock scrolls
 * with the bar instead of jumping back to the viewport edge.
 */
const DOCK_VAR = '--header-dock'

/** Duration of the dock offset; nonzero only while the bar animates in. */
const DOCK_MOTION_VAR = '--header-dock-transition'

/** Matches the reveal animation on the bar. */
const REVEAL_MS = 150

/** Animate the reveal only when the user has not asked for less motion. */
function shouldAnimateReveal(reveal: boolean) {
	return reveal && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
 * page is still scrolling through it.
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
		let dockPx = Number.NaN
		let dockMotion = Number.NaN

		/**
		 * Publish how much of the bar still covers the viewport top. The dock
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
			const animate = shouldAnimateReveal(reveal)

			bar.style.position = 'fixed'
			bar.style.top = '0px'
			applyDock(bar.offsetHeight, animate ? REVEAL_MS : 0)
			bar.toggleAttribute('data-reveal', animate)
			pinned.current = true
		}

		const update = () => {
			const scrollY = window.scrollY
			const last = lastScrollY.current

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
			/** Keep the published height current across breakpoints (the bar grows to 64/72px). */
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

			if (frame) cancelAnimationFrame(frame)
		}
	}, [barRef, slotRef])
}

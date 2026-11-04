import {type RefObject, useState} from 'react'

import {useIsomorphicLayoutEffect} from '#/hooks/use-isomorphic-layout-effect.ts'

import {getViewportHeight} from '../-utils/viewport.ts'

/**
 * Reveals the gallery chrome as the first conversation finishes revealing.
 * The trigger is the last message, so the frame, label, neighbors, and dots
 * appear only after the reader has seen the conversation as a single chat.
 * The chrome starts on the frame the last message lands, with no hold.
 */
export function useGalleryActive(
	galleryRef: RefObject<HTMLElement | null>,
	conversationEndVh: number,
) {
	const [active, setActive] = useState(false)

	useIsomorphicLayoutEffect(() => {
		const gallery = galleryRef.current

		const trigger = gallery?.querySelector<HTMLElement>(
			'[data-slide-index="0"] [data-gallery-trigger]',
		)

		if (!gallery || !trigger) return

		/** Match the reveal’s 1svh probe so both thresholds move together. */
		const probe = gallery
			.closest('[data-intro-sections]')
			?.querySelector<HTMLElement>('[data-svh-probe]')

		let frame = 0
		let lastActive = false

		const update = () => {
			frame = 0

			const viewport = getViewportHeight(probe ?? null)

			if (viewport <= 0) return

			const triggerTopVh = (trigger.getBoundingClientRect().top / viewport) * 100
			const nextActive = triggerTopVh <= conversationEndVh

			if (nextActive === lastActive) return

			lastActive = nextActive
			setActive(nextActive)
		}

		const schedule = () => {
			if (frame) return

			frame = requestAnimationFrame(update)
		}

		update()
		window.addEventListener('scroll', schedule, {passive: true})
		window.addEventListener('resize', schedule)

		const resizeObserver = new ResizeObserver(schedule)
		resizeObserver.observe(gallery)

		return () => {
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)
			resizeObserver.disconnect()

			if (frame) cancelAnimationFrame(frame)
		}
	}, [conversationEndVh, galleryRef])

	return active
}

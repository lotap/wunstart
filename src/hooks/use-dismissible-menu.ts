import {type RefObject, useEffect} from 'react'

type DismissibleMenuOptions = {
	open: boolean
	setOpen: (open: boolean) => void
	containerRef: RefObject<HTMLElement | null>
	triggerRef: RefObject<HTMLElement | null>
}

/**
 * Close a transient menu on scroll, resize, outside press, or Escape.
 * Escape returns focus to the trigger.
 */
export function useDismissibleMenu({
	open,
	setOpen,
	containerRef,
	triggerRef,
}: DismissibleMenuOptions) {
	useEffect(() => {
		if (!open) return

		const close = () => setOpen(false)

		const onPointerDown = (event: PointerEvent) => {
			if (event.target instanceof Node && !containerRef.current?.contains(event.target)) close()
		}

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return

			close()
			triggerRef.current?.focus()
		}

		const onScroll = () => {
			// A locked page cannot really scroll; ignore the programmatic reset.
			if (document.body.style.overflow === 'hidden') return
			close()
		}

		window.addEventListener('scroll', onScroll, {passive: true})
		window.addEventListener('resize', close)
		document.addEventListener('pointerdown', onPointerDown)
		window.addEventListener('keydown', onKeyDown)

		return () => {
			window.removeEventListener('scroll', onScroll)
			window.removeEventListener('resize', close)
			document.removeEventListener('pointerdown', onPointerDown)
			window.removeEventListener('keydown', onKeyDown)
		}
	}, [open, setOpen, containerRef, triggerRef])
}

import {useIsomorphicLayoutEffect} from './use-isomorphic-layout-effect.ts'

/** The `md` breakpoint: the menu is a full-bleed sheet below it. */
const SHEET_QUERY = '(width < 48rem)'

/**
 * Lock the page behind the full-bleed menu. Above `md` the trigger is hidden,
 * so the sheet can only be open across a resize; the query guard handles that.
 */
export function useSheetLock(open: boolean) {
	useIsomorphicLayoutEffect(() => {
		if (!open) return

		const query = window.matchMedia(SHEET_QUERY)
		const page = [...document.querySelectorAll<HTMLElement>('main, footer')]
		const previousOverflow = document.body.style.overflow

		const apply = () => {
			const locked = query.matches
			document.body.style.overflow = locked ? 'hidden' : previousOverflow

			for (const element of page) {
				if (locked) element.setAttribute('inert', '')
				else element.removeAttribute('inert')
			}

			// The sheet is absolute under the header; start at the top so it covers the viewport.
			if (locked) window.scrollTo(0, 0)
		}

		apply()
		query.addEventListener('change', apply)

		return () => {
			query.removeEventListener('change', apply)
			document.body.style.overflow = previousOverflow

			for (const element of page) element.removeAttribute('inert')
		}
	}, [open])
}

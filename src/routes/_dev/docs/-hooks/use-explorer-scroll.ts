import {type RefObject, useEffect, useRef} from 'react'

import {scrollBehavior, scrollToTopEdge} from '../-utils/scroll.ts'

/**
 * The docs page owns its scroll because `/docs` opts out of router scroll
 * restoration. On arrival, a hash or panel is a deep link; otherwise reset the
 * offset a client navigation kept from the previous page.
 */
function scrollToDocsTarget(
	section: HTMLElement | null,
	behavior: ScrollBehavior,
	options: {holdBar?: boolean} = {},
) {
	const hash = window.location.hash.slice(1)
	const hashTarget = hash ? document.getElementById(hash) : null

	if (hashTarget) {
		scrollToTopEdge(hashTarget, behavior, options)

		return
	}

	if (section && new URLSearchParams(window.location.search).has('panel')) {
		scrollToTopEdge(section, behavior, options)

		return
	}

	window.scrollTo({top: 0, behavior})
}

/**
 * Keep the explorer aligned with the selected panel. Swapping panel content
 * cancels an in-flight smooth scroll, so the scroll runs after the commit. The
 * alignment holds the site bar so realigning upward doesn’t pull it back in.
 */
export function useExplorerScroll(sectionRef: RefObject<HTMLElement | null>, selectionKey: string) {
	const previousSelection = useRef(selectionKey)

	useEffect(() => {
		scrollToDocsTarget(sectionRef.current, 'instant')
	}, [sectionRef])

	useEffect(() => {
		if (previousSelection.current === selectionKey) return

		previousSelection.current = selectionKey

		const behavior: ScrollBehavior = new URLSearchParams(window.location.search).has('panel')
			? scrollBehavior()
			: 'instant'

		scrollToDocsTarget(sectionRef.current, behavior, {holdBar: true})
	}, [sectionRef, selectionKey])
}

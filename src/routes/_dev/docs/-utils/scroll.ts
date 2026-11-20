/** The site bar’s stable DOM hook, set by the global header. */
const HEADER_BAR_SELECTOR = '[data-header-bar]'

/** Smooth scrolling unless the user asked for less motion. */
export function scrollBehavior(): ScrollBehavior {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}

/**
 * Scroll `target` to the reading edge, clear of the site bar. An upward scroll
 * pins the bar, and an instant jump past the viewport pins it as it lands, so
 * the target reserves the bar’s height before it appears.
 */
export function scrollToTopEdge(target: HTMLElement, behavior: ScrollBehavior) {
	const scrollY = window.scrollY
	const inset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
	const edge = target.getBoundingClientRect().top + scrollY - inset
	const bar = document.querySelector<HTMLElement>(HEADER_BAR_SELECTOR)
	const barHeight = bar?.offsetHeight ?? 0
	const pinned = bar ? getComputedStyle(bar).position === 'fixed' : false
	let next = edge - (pinned ? barHeight : 0)

	if (pinned && next > scrollY) {
		// A downward scroll releases the bar, so the target can use the edge.
		next = edge
	} else if (!pinned && next < scrollY) {
		// The upward scroll pins the bar before smooth scrolling reaches the target.
		next = edge - barHeight
	} else if (!pinned && behavior === 'instant' && next - scrollY > window.innerHeight) {
		// The jump pins the bar before it lands; reserve the bar up front.
		next = edge - barHeight
	}

	window.scrollTo({top: Math.max(next, 0), behavior})
}

/** The site bar’s stable DOM hook, set by the global header. */
const HEADER_BAR_SELECTOR = '[data-header-bar]'

/** Set on the bar while a programmatic scroll must not reveal it. */
const HOLD_ATTR = 'data-hold-pin'

/** Backstop after the last scroll event when `scrollend` is unavailable. */
const HOLD_MS = 500

let releaseHold: (() => void) | null = null

/** Smooth scrolling unless the user asked for less motion. */
export function scrollBehavior(): ScrollBehavior {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}

/**
 * Keep the bar released for the duration of a programmatic scroll. The flag
 * clears on `scrollend`; the debounced timeout covers a missed event.
 */
function holdBarPin(bar: HTMLElement) {
	releaseHold?.()

	bar.setAttribute(HOLD_ATTR, '')

	let timer = 0
	let frame = 0

	const release = () => {
		window.clearTimeout(timer)
		window.cancelAnimationFrame(frame)
		document.removeEventListener('scrollend', onScrollEnd)
		document.removeEventListener('scroll', onScroll)
		bar.removeAttribute(HOLD_ATTR)

		if (releaseHold === release) releaseHold = null
	}

	/**
	 * The header’s last scroll update is queued for the next frame; clear after
	 * it so that update still reads the flag instead of pinning the bar.
	 */
	const onScrollEnd = () => {
		frame = window.requestAnimationFrame(release)
	}

	const onScroll = () => {
		window.clearTimeout(timer)
		timer = window.setTimeout(release, HOLD_MS)
	}

	timer = window.setTimeout(release, HOLD_MS)
	document.addEventListener('scroll', onScroll, {passive: true})
	document.addEventListener('scrollend', onScrollEnd, {once: true})

	releaseHold = release
}

/**
 * Scroll `target` to the reading edge, clear of the site bar. An upward scroll
 * pins the bar, and an instant jump past the viewport pins it as it lands, so
 * the target reserves the bar’s height before it appears.
 *
 * `holdBar` keeps that reveal from happening, so an upward programmatic scroll
 * lands on the reading edge itself instead of below the pinned bar.
 */
export function scrollToTopEdge(
	target: HTMLElement,
	behavior: ScrollBehavior,
	{holdBar = false} = {},
) {
	const scrollY = window.scrollY
	const inset = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
	const edge = target.getBoundingClientRect().top + scrollY - inset
	const bar = document.querySelector<HTMLElement>(HEADER_BAR_SELECTOR)
	const barHeight = bar?.offsetHeight ?? 0
	const pinned = bar ? getComputedStyle(bar).position === 'fixed' : false
	let next = edge - (pinned && !holdBar ? barHeight : 0)

	if (pinned && next > scrollY) {
		// A downward scroll releases the bar, so the target can use the edge.
		next = edge
	} else if (!pinned && !holdBar && next < scrollY) {
		// The upward scroll pins the bar before smooth scrolling reaches the target.
		next = edge - barHeight
	} else if (!pinned && !holdBar && behavior === 'instant' && next - scrollY > window.innerHeight) {
		// The jump pins the bar before it lands; reserve the bar up front.
		next = edge - barHeight
	}

	const top = Math.max(next, 0)

	if (holdBar && bar && top !== scrollY) holdBarPin(bar)

	window.scrollTo({top, behavior})
}

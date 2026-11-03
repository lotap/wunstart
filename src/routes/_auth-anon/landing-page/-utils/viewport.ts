/**
 * Read the viewport height from a 1svh probe so mobile browser chrome changes
 * do not shift scroll-linked thresholds.
 */
export function getViewportHeight(probe: HTMLElement | null) {
	const probeHeight = probe?.getBoundingClientRect().height ?? 0

	return probeHeight > 0 ? probeHeight * 100 : window.innerHeight
}

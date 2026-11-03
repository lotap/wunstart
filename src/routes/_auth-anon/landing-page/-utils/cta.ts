/** How early the exit starts before the CTA bottom reaches the viewport bottom, in viewport heights. */
export const CTA_EXIT_LEAD_VH = 8

/** Viewport multiple where the CTA footer hand-off starts. */
export const CTA_EXIT_START_VIEWPORTS = 1 + CTA_EXIT_LEAD_VH / 100

type ScrollToStartPanelOptions = {
	behavior?: ScrollBehavior
}

/**
 * Skip the CTA intro and land on the install panels. Stop short of the
 * footer hand-off so the panels arrive fully lit.
 */
export function scrollToStartPanel({behavior = 'smooth'}: ScrollToStartPanelOptions = {}) {
	const panel = document.getElementById('get-started-panel')

	if (!panel) return false

	const panelTop = panel.getBoundingClientRect().top + window.scrollY
	const clearance = Number.parseFloat(getComputedStyle(panel).scrollMarginTop) || 0
	const section = panel.closest('section')

	const exitLimit = section
		? section.getBoundingClientRect().bottom +
			window.scrollY -
			window.innerHeight * CTA_EXIT_START_VIEWPORTS
		: Number.POSITIVE_INFINITY

	const top = Math.max(Math.min(panelTop - clearance, exitLimit), 0)

	window.scrollTo({top, behavior})

	return true
}

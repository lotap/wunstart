import {UAParser} from 'ua-parser-js'

/**
 * Formats a user-agent as a display string (e.g. 'Chrome 126 on Windows (Desktop)')
 * for notification emails. Returns null when nothing usable is known, so templates
 * can omit the line entirely
 *
 * Display use only: user-agents are client-controlled and trivially spoofed, so
 * this must never feed auth, rate-limiting, or ban decisions
 */
export const formatUserAgent = (userAgent: string): string | null => {
	const {browser, os, device} = UAParser(userAgent)

	if (!browser.name && !os.name) return null

	const browserLabel = browser.name
		? browser.major
			? `${browser.name} ${browser.major}`
			: browser.name
		: undefined
	const parts = [browserLabel, os.name].filter((part) => part !== undefined)
	const deviceLabel =
		device.type === 'tablet' ? 'Tablet' : device.type === 'mobile' ? 'Mobile' : 'Desktop'

	return `${parts.join(' on ')} (${deviceLabel})`
}

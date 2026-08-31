import {UAParser} from 'ua-parser-js'

export type UserAgentInfo = {
	/** e.g. 'Chrome 126', 'Safari', 'Unknown' */
	browser: string
	/** e.g. 'Windows', 'iOS', 'Unknown' */
	os: string
	device: 'mobile' | 'tablet' | 'desktop'
}

/**
 * Best-effort device/browser guess from a raw user-agent string, powered by
 * ua-parser-js 1.x (MIT — pinned to major 1; 2.x is AGPL-3.0).
 *
 * Display use only: user-agents are client-controlled and trivially spoofed, so
 * this must never feed auth, rate-limiting, or ban decisions.
 */
export const describeUserAgent = (userAgent: string): UserAgentInfo => {
	const {browser, os, device} = UAParser(userAgent)

	return {
		browser: browser.name
			? browser.major
				? `${browser.name} ${browser.major}`
				: browser.name
			: 'Unknown',
		os: os.name ?? 'Unknown',
		device: device.type === 'mobile' || device.type === 'tablet' ? device.type : 'desktop',
	}
}

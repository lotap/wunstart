import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'

const PERCENT_ENCODED_PATTERN = /%[0-9A-Fa-f]{2}/

/** Decode a percent-encoded header value (e.g. CF's `cf-ipcity`), falling back to the raw value */
const decodeHeaderValue = (value: string) => {
	if (!PERCENT_ENCODED_PATTERN.test(value)) return value

	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

/** Normalize an optional geolocation header to a bounded value, or null when absent/empty */
const geoHeaderValue = (header: string, maxLength: number) => {
	const raw = getRequestHeader(header)

	return raw ? decodeHeaderValue(raw.trim()).slice(0, maxLength) || null : null
}

/** Read the `cf-timezone` visitor-location header, returning null when absent or not a valid IANA zone */
const timezoneHeaderValue = () => {
	const raw = geoHeaderValue('cf-timezone', 64)

	if (!raw) return null

	try {
		new Intl.DateTimeFormat('en-US', {timeZone: raw}).format(new Date())
		return raw
	} catch {
		return null
	}
}

export const getRequestInfo = createMiddleware().server(({next}) => {
	const ipAddress =
		getRequestHeader('cf-connecting-ip') ?? getRequestIP({xForwardedFor: true}) ?? '0.0.0.0'

	const userAgent = (getRequestHeader('user-agent') ?? 'unknown').trim().slice(0, 512)

	/**
	 * Geolocation varies by provider; defaults to Cloudflare's visitor-location headers.
	 * Country falls back to `XX` (CF's own "unknown client country" sentinel), while
	 * city/region/timezone stay null when absent — absence is not a place
	 */
	const country = (getRequestHeader('cf-ipcountry') || 'XX').trim().slice(0, 2)
	const city = geoHeaderValue('cf-ipcity', 128)
	const region = geoHeaderValue('cf-region-code', 64)
	const timezone = timezoneHeaderValue()

	return next({context: {ipAddress, userAgent, country, city, region, timezone}})
})

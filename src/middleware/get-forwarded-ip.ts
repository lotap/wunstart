import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'

/** Decode a percent-encoded header value (e.g. CF's `cf-ipcity`), falling back to the raw value */
const decodeHeaderValue = (value: string) => {
	if (!/%[0-9A-Fa-f]{2}/.test(value)) return value

	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

export const getForwardedIp = createMiddleware().server(({next}) => {
	const ipAddress =
		getRequestHeader('cf-connecting-ip') ?? getRequestIP({xForwardedFor: true}) ?? '0.0.0.0'

	/** Cap matching the UserAgent validation, so hostile headers can't fail ops downstream */
	const userAgent = (getRequestHeader('user-agent') ?? 'unknown').trim().slice(0, 512)

	/**
	 * Geolocation varies by provider; defaults to Cloudflare's visitor-location headers.
	 * `cf-ipcountry` falls back to `XX` (CF's "unknown client country"); city/region
	 * fall back to 'unknown' since the managed transform headers may be absent
	 */
	const country = (getRequestHeader('cf-ipcountry') || 'XX').trim().slice(0, 2)

	/** Cap before decoding to bound input */
	const city = decodeHeaderValue((getRequestHeader('cf-ipcity') || 'unknown').trim().slice(0, 128))

	const region = (getRequestHeader('cf-region-code') || 'unknown').trim().slice(0, 64)

	return next({context: {ipAddress, userAgent, country, city, region}})
})

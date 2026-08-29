import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'

/** Cap matching the UserAgent validation, so hostile headers can't fail ops downstream */
const USER_AGENT_MAX_LENGTH = 512
/** Cap matching the Country validation; ISO-2 codes and CF's `T1` (Tor) are 2 chars */
const COUNTRY_MAX_LENGTH = 2

export const getForwardedIp = createMiddleware().server(({next}) => {
	const ipAddress =
		getRequestHeader('cf-connecting-ip') ?? getRequestIP({xForwardedFor: true}) ?? '0.0.0.0'

	const userAgent = (getRequestHeader('user-agent') ?? 'unknown')
		.trim()
		.slice(0, USER_AGENT_MAX_LENGTH)

	/**
	 * Geolocation varies by provider; defaults to Cloudflare's `cf-ipcountry`.
	 * Falls back to `XX` (CF's "unknown client country"), also used for empty headers
	 */
	const country = (getRequestHeader('cf-ipcountry') || 'XX').trim().slice(0, COUNTRY_MAX_LENGTH)

	return next({context: {ipAddress, userAgent, country}})
})

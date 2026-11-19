import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'
import {Result, Schema} from 'effect'

import {INVALID_IP_SENTINEL} from '#/db/helpers/ip-sentinels.ts'
import {IpAddress} from '#/db/helpers/validators.ts'

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

/**
 * Production is Cloudflare Workers: the edge overwrites `cf-connecting-ip`.
 * Do not trust `X-Forwarded-For`/`Forwarded` here; a client can forge them when
 * the origin is reachable directly. Change this only for a deployment whose
 * proxy is verified to overwrite the header.
 */
const TRUSTED_IP_HEADER = 'cf-connecting-ip' as const

const decodeIp = Schema.decodeUnknownResult(IpAddress)

/** Resolve a raw header or socket value to a valid `inet` string, or null */
const resolveValidIp = (raw: string | undefined) => {
	if (!raw) return null

	const parsed = decodeIp(raw.trim())

	return Result.isSuccess(parsed) ? parsed.success : null
}

export const getRequestInfo = createMiddleware().server(({next}) => {
	/**
	 * Preserve the full address for user-facing security displays; IPv6 /64
	 * normalization belongs to the in-memory rate limiter. An address we cannot
	 * validate falls back to the shared sentinel so it can never reach `inet` columns.
	 * The sentinel is also one shared IP_ADDRESS ban target: a deployment reachable
	 * without a trusted client IP must provide one or fail closed elsewhere.
	 */
	const ipAddress =
		resolveValidIp(getRequestHeader(TRUSTED_IP_HEADER)) ??
		resolveValidIp(getRequestIP({xForwardedFor: false})) ??
		INVALID_IP_SENTINEL

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

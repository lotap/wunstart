import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'
import {Result, Schema} from 'effect'

import {isClientIpAddress} from '#/db/helpers/ip-sentinels.ts'
import {IpAddress} from '#/db/helpers/validators.ts'
import {isValidTimeZone} from '#/lib/timezone.ts'

import {SERVICE_UNAVAILABLE_MESSAGE} from './_messages.ts'
import {throwKnownServerError} from './known-server-error.ts'

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

	return raw && isValidTimeZone(raw) ? raw : null
}

/**
 * The current deployment target is Cloudflare Workers, where the edge
 * overwrites `cf-connecting-ip`. Do not trust `X-Forwarded-For`/`Forwarded`
 * here; a client can forge them when the origin is reachable directly. The
 * socket fallback assumes a directly exposed Node process; behind a local
 * proxy it is the proxy's address, so a proxied deployment must supply this
 * header. A per-deployment source setting is the portability follow-up.
 */
const TRUSTED_IP_HEADER = 'cf-connecting-ip' as const

/**
 * Development-only address when the local runtime exposes no socket address.
 *
 * Gate on MODE, not DEV: Vite sets `DEV=false` for every build, and
 * `build:preview` builds with `--mode development`. A production build uses
 * mode production and still fails closed.
 */
const DEV_CLIENT_IP = '127.0.0.1'

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
	 * normalization belongs to the in-memory rate limiter. The address feeds
	 * rate limits, bans, and the known-IP bypass, so never invent one: a
	 * production request that cannot resolve a client IP fails closed, while
	 * development falls back to loopback so the app stays usable.
	 */
	const resolvedIp =
		resolveValidIp(getRequestHeader(TRUSTED_IP_HEADER)) ??
		resolveValidIp(getRequestIP({xForwardedFor: false})) ??
		(import.meta.env.MODE === 'development' ? DEV_CLIENT_IP : null)

	if (!resolvedIp || !isClientIpAddress(resolvedIp)) {
		throwKnownServerError(503, SERVICE_UNAVAILABLE_MESSAGE)
	}

	const ipAddress = resolvedIp

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

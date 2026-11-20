import {createMiddleware, createServerOnlyFn} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'

import {getRequestInfo} from './get-request-info.ts'
import {KnownServerError} from './sanitize-errors.ts'

/**
 * Max accumulated score before a request is rejected.
 *
 * Independent of the values set in [the activities model]{@link (file://./../db/models/activities/consts.ts)};
 * this threshold is in-memory only, never persisted to the database.
 */
const THRESHOLD = 12_600 // Least Common Multiple of 1-10 & 25

/** How long to hold points for a request */
const WINDOW_MS = 60_000 // 1 min

/** Hard cap on tracked keys so spoofed addresses cannot grow the store without bound */
const MAX_STORE_ENTRIES = 10_000

/** In-memory score store keyed by rate-limit key. */
const store = new Map<
	string,
	{
		weight: number
		timestamp: number
	}[]
>()

const IPV4_TAIL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

/** Rewrite a dotted IPv4 tail into two hexadecimal hextets, or null if absent */
const expandIpv4Tail = (ipAddress: string) => {
	const separator = ipAddress.lastIndexOf(':'),
		match = IPV4_TAIL.exec(ipAddress.slice(separator + 1))

	if (separator < 0 || !match) return null

	const [a = 0, b = 0, c = 0, d = 0] = match.slice(1).map(Number)

	return `${ipAddress.slice(0, separator + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
}

/**
 * Normalizes IPv6 addresses to their /64 prefix so a client rotating interface
 * identifiers within a single /64 allocation shares one rate-limit bucket.
 *
 * A dotted tail is valid IPv6 notation, not proof of IPv4: expand it to hextets
 * before taking the prefix, otherwise every interface identifier in a routed
 * /64 becomes its own bucket. An IPv4-mapped address collapses to the wrapped
 * IPv4 key, so the same client is not counted under mapped and plain forms
 * separately, and mapped clients do not all share the zero /64.
 */
const toRateLimitKey = (ipAddress: string) => {
	const lower = ipAddress.toLowerCase()

	if (!lower.includes(':')) return lower

	const expanded = lower.includes('.') ? expandIpv4Tail(lower) : lower

	if (!expanded) return lower

	const [head = '', tail = ''] = expanded.split('::')
	const headParts = head ? head.split(':') : []
	const tailParts = tail ? tail.split(':') : []
	const missing = 8 - headParts.length - tailParts.length

	if (missing < 0) return lower

	const full = [...headParts, ...Array.from({length: missing}, () => '0'), ...tailParts]

	const [first, second, third, fourth, fifth, sixth, seventh, eighth] = full.map((hextet) =>
		Number.parseInt(hextet, 16),
	)

	if (
		first === 0 &&
		second === 0 &&
		third === 0 &&
		fourth === 0 &&
		((fifth === 0 && sixth === 0xffff) || (fifth === 0xffff && sixth === 0))
	) {
		const high = seventh ?? 0
		const low = eighth ?? 0

		return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
	}

	return `${full
		.slice(0, 4)
		.map((hextet) => hextet.padStart(4, '0'))
		.join(':')}::/64`
}

let cleanCounter = 0

/** Cleans up store by removing expired events and ip addresses without active events */
const cleanup = () => {
	for (const [ip, events] of store) {
		const filteredEvents = events.filter((event) => event.timestamp > Date.now() - WINDOW_MS)

		if (filteredEvents.length) {
			store.set(ip, filteredEvents)
		} else {
			store.delete(ip)
		}
	}

	cleanCounter = 0
}

/** Calculate the per-request weight for a given max-requests-per-window.*/
export function allowPerWindow(maxAllowedPerWindow: number) {
	if (maxAllowedPerWindow <= 0) throw new Error('maxAllowedPerWindow must be a positive integer')

	return Math.ceil(THRESHOLD / maxAllowedPerWindow)
}

/**
 * Rejects the request with 429. Wrapped in `createServerOnlyFn` because
 * `setResponseStatus` is a server-only API. This keeps the client build clean
 * while `addRateLimitEvent` stays usable from isomorphic modules.
 */
const rejectRateLimited = createServerOnlyFn(() => {
	setResponseStatus(429)
	throw new KnownServerError({message: 'Slow down a bit, then try again.'})
})

/**
 * Record a scored event for a rate-limit key and check the threshold.
 *
 * Expired events (older than `WINDOW_MS`) are pruned before the check.
 * If the accumulated score exceeds `THRESHOLD`, the response is set to 429
 * and a `KnownServerError` is thrown. Once a key is over threshold, further
 * events are rejected without being recorded, so a flooded key cannot grow
 * its own event array or slide its window forward. This must only be called
 * within a request context (middleware or server function).
 *
 * `scope` namespaces the key so a tighter lane can count a subset of requests
 * without spending the global per-IP budget.
 *
 * @throws {KnownServerError} with HTTP 429 when threshold is breached.
 */
export function addRateLimitEvent({
	ipAddress,
	weight,
	scope,
}: {
	ipAddress: string
	weight: number
	scope?: string
}) {
	const now = Date.now()
	const normalizedIp = toRateLimitKey(ipAddress)
	const key = scope ? `${scope}:${normalizedIp}` : normalizedIp

	if (!store.has(key) && store.size >= MAX_STORE_ENTRIES) {
		/**
		 * O(1) FIFO eviction. The full prune stays on the amortized cleanup
		 * path above; sweeping 10k keys here would let an attacker at capacity
		 * trigger an O(store × events) scan on every new key.
		 */
		const oldestKey = store.keys().next().value

		if (oldestKey !== undefined) store.delete(oldestKey)
	}

	const events = store.get(key)?.filter((event) => event.timestamp > now - WINDOW_MS) ?? []

	const previousWeight = events.reduce((sum, event) => sum + event.weight, 0)

	if (previousWeight > THRESHOLD) return rejectRateLimited()

	events.unshift({weight, timestamp: now})
	store.set(key, events)

	if (previousWeight + weight > THRESHOLD) rejectRateLimited()
}

/**
 * Per-IP rate limiting middleware. Not shared across clusters/instances/isolates.
 * Defense in depth only; pair with a real edge rate limit + a real redis/db solution
 * Each request adds ({@link THRESHOLD} / max) weight to the ip's score with a timestamp; events older than {@link WINDOW_MS} are ignored.
 * Requests over the limit are rejected with HTTP 429.
 *
 * Expired events are purged every 10_000 requests as a safeguard.
 *
 * @argument max The number of requests allowed by an ip within {@link WINDOW_MS}. Must be a positive integer to function as intended
 */
export function createRateLimit(max: number) {
	return createMiddleware({type: 'function'})
		.middleware([getRequestInfo])
		.server(async ({next, context: {ipAddress}}) => {
			cleanCounter++

			if (cleanCounter > 10_000) cleanup()

			addRateLimitEvent({ipAddress, weight: allowPerWindow(max)})

			return next()
		})
}

/** Default: 5 requests per minute per ip */
export const rateLimit = createRateLimit(5)

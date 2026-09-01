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

/** In-memory score store keyed by ip. */
const store = new Map<
	string,
	{
		weight: number
		timestamp: number
	}[]
>()

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
 * Record a scored event for an IP address and check the rate-limit threshold.
 *
 * Expired events (older than `WINDOW_MS`) are pruned before the check.
 * If the accumulated score exceeds `THRESHOLD`, the response is set to 429
 * and a `KnownServerError` is thrown. This must only be called within a
 * request context (middleware or server function).
 *
 * @throws {KnownServerError} with HTTP 429 when threshold is breached.
 */
export function addRateLimitEvent({ipAddress, weight}: {ipAddress: string; weight: number}) {
	const now = Date.now()
	const events = store.get(ipAddress)?.filter((e) => e.timestamp > now - WINDOW_MS) ?? []
	events.unshift({weight, timestamp: now})
	store.set(ipAddress, events)

	let sum = 0

	for (const {weight: _weight} of events) {
		sum = sum + _weight

		if (sum > THRESHOLD) rejectRateLimited()
	}
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

import {createMiddleware, createServerOnlyFn} from '@tanstack/react-start'

import {ipNetwork} from '#/db/helpers/ip-network.ts'

import {RATE_LIMITED_MESSAGE} from './_messages.ts'
import {getRequestInfo} from './get-request-info.ts'
import {throwKnownServerError} from './known-server-error.ts'

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

/**
 * The limiter's key is the client's network, the same key the ban pipeline
 * stores, so the request limit and a ban can never disagree about a subject.
 *
 * Malformed input falls back to the raw lowercase value: the limiter must not
 * fail a request over an address it cannot parse, while the ban path throws
 * because it only sees validated addresses.
 */
const toRateLimitKey = (ipAddress: string) => {
	try {
		return ipNetwork(ipAddress)
	} catch {
		return ipAddress.toLowerCase()
	}
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
 * rejecting a request only makes sense in a server request context, while
 * `addRateLimitEvent` stays usable from isomorphic modules.
 */
const rejectRateLimited = createServerOnlyFn(() => {
	throwKnownServerError(429, RATE_LIMITED_MESSAGE)
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
	/**
	 * `|` as the separator because the key now carries a network: `:` already
	 * appears inside IPv6 addresses and `/` inside CIDR, so neither is safe.
	 * Scopes are fixed constants and `|` cannot appear in either component.
	 */
	const key = scope ? `${scope}|${normalizedIp}` : normalizedIp

	if (!store.has(key) && store.size >= MAX_STORE_ENTRIES) {
		/**
		 * O(1) least-recently-used eviction. The full prune stays on the amortized
		 * cleanup path above; sweeping 10k keys here would let an attacker at
		 * capacity trigger an O(store × events) scan on every new key.
		 */
		const oldestKey = store.keys().next().value

		if (oldestKey !== undefined) store.delete(oldestKey)
	}

	const events = store.get(key)?.filter((event) => event.timestamp > now - WINDOW_MS) ?? []

	const previousWeight = events.reduce((sum, event) => sum + event.weight, 0)

	if (previousWeight > THRESHOLD) {
		/** Re-insert so an active blocked bucket cannot age out and reset its score */
		if (store.has(key)) {
			store.delete(key)
			store.set(key, events)
		}

		return rejectRateLimited()
	}

	events.unshift({weight, timestamp: now})

	/** Re-insert on access so Map order is least-recently-used, not insertion order */
	store.delete(key)
	store.set(key, events)

	if (previousWeight + weight > THRESHOLD) rejectRateLimited()
}

/**
 * Sign-out attempts allowed per IP per minute. Sign-out runs the Argon2 nonce
 * check but cannot guess a credential, and one shared egress can legitimately
 * produce several sign-outs at once. Its own lane keeps a sign-out burst from
 * spending the 5/min credential budget; the global limiter stays the outer
 * bound.
 */
const SIGN_OUT_ATTEMPTS_PER_MINUTE = 30

/**
 * Per-IP rate limiting middleware. Not shared across clusters/instances/isolates.
 * Defense in depth only; pair with a real edge rate limit + a real redis/db solution
 * Each request adds ({@link THRESHOLD} / max) weight to the ip's score with a timestamp; events older than {@link WINDOW_MS} are ignored.
 * Requests over the limit are rejected with HTTP 429.
 *
 * Expired events are purged every 10_000 requests as a safeguard.
 *
 * @argument max The number of requests allowed by an ip within {@link WINDOW_MS}. Must be a positive integer to function as intended
 * @argument scope Optional namespace for a dedicated bucket; omit to spend the shared per-IP score
 */
export function createRateLimit(max: number, scope?: string) {
	return createMiddleware({type: 'function'})
		.middleware([getRequestInfo])
		.server(async ({next, context: {ipAddress}}) => {
			cleanCounter++

			if (cleanCounter > 10_000) cleanup()

			addRateLimitEvent({ipAddress, weight: allowPerWindow(max), scope})

			return next()
		})
}

/** Default: 5 requests per minute per ip */
export const rateLimit = createRateLimit(5)

/**
 * Sign-out lane: 30 requests per minute per IP, keyed `sign-out|<network>`.
 * Both sign-out handlers run the refresh nonce check, so the lane bounds the
 * Argon2 work without charging it to the shared auth budget.
 */
export const signOutRateLimit = createRateLimit(SIGN_OUT_ATTEMPTS_PER_MINUTE, 'sign-out')

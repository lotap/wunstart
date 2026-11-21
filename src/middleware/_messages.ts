/**
 * User-facing copy emitted by middleware at the HTTP boundary.
 *
 * Every middleware display message lives here by default, regardless of how
 * many flows use it. Internal/log text stays with the middleware that owns it;
 * client-imported contract strings live in `#/isomorphic`.
 */

/** Neutral 503 copy for a request the app cannot serve at all. */
export const SERVICE_UNAVAILABLE_MESSAGE =
	'We hit a temporary snag on our end. Please try again in a moment.'

/** The request exceeded an in-memory rate-limit window. */
export const RATE_LIMITED_MESSAGE = 'Slow down a bit, then try again.'

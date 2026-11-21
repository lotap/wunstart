/**
 * Auth copy shared across the ops layer.
 *
 * Client-matched contract strings live in `#/isomorphic/auth-messages.ts`.
 * These are reused by ops and their server functions, where the same copy
 * would otherwise drift between inline literals and per-file constants.
 */

/**
 * Neutral failure shared by post-auth flows that intentionally use the same
 * copy. Every sensitive branch within a flow must still return this one
 * message; pre-auth flows keep their own wording.
 */
export const GENERIC_AUTH_FAILURE_MESSAGE = 'Something went wrong. Please try again.'

/** The sudo lease behind a protected action has lapsed. */
export const VERIFICATION_EXPIRED_MESSAGE =
	'Your verification has expired. Re-verify, then try again.'

/** An anon identity outlived the row behind it; the cookie must be replaced. */
export const ANON_SESSION_EXPIRED_MESSAGE = 'Your session expired. Refresh the page and try again.'

/** The verification row is burned, expired, or superseded. */
export const INVALID_PASSCODE_MESSAGE = 'That code is no longer valid. Request a fresh one.'

/**
 * An access-token verification failure. `verifyAuth` falls through to the
 * refresh cookie, so this never reaches the client and is not the
 * client-recognized session-expired string.
 */
export const ACCESS_TOKEN_FAILURE_MESSAGE = 'The access token could not be verified.'

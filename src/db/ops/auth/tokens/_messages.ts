/**
 * Copy emitted only by token verification.
 *
 * Promote a message to `../messages.ts` when a second auth scope emits it.
 */

/**
 * An access-token verification failure. `verifyAuth` falls through to the
 * refresh cookie, so this never reaches the client and is not the
 * client-recognized session-expired string.
 */
export const ACCESS_TOKEN_FAILURE_MESSAGE = 'The access token could not be verified.'

/** Generic fallback for an auth infrastructure failure the client can only retry. */
export const AUTH_INTERNAL_FAILURE_MESSAGE = 'Something went wrong. Please try again later.'

/** Neutral anon-token verification failure. */
export const ANON_VERIFICATION_FAILED_MESSAGE =
	'We couldn’t verify your session. Refresh the page and try again.'

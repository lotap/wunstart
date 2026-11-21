/**
 * Copy emitted by auth ops and their server fns.
 *
 * Every message intended for a reader lives here by default, including
 * server-only copy that never reaches the client, regardless of consumer
 * count. Audit causes, parameter guards, internal state-error text, and log
 * text are diagnostics and stay at the branch; client-imported contract
 * strings live in `#/isomorphic/auth-messages.ts`.
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

/** Generic fallback for an auth infrastructure failure the client can only retry. */
export const AUTH_INTERNAL_FAILURE_MESSAGE = 'Something went wrong. Please try again later.'

/** Sign-up found the email already attached to an account. */
export const EMAIL_ALREADY_REGISTERED_MESSAGE =
	'That email already has an account. Try signing in instead.'

/** Email change targeted the address already on the account. */
export const EMAIL_UNCHANGED_MESSAGE = 'That is already your email address.'

/** The verification row reached the wrong-code attempt cap. */
export const TOO_MANY_PASSCODE_ATTEMPTS_MESSAGE =
	'Too many tries. Request a fresh code to start over.'

/** The submitted passcode did not match. */
export const WRONG_PASSCODE_MESSAGE = 'That code isn’t right. Double-check it and try again.'

/** A reset was requested inside the previous code’s cooldown. */
export const PASSCODE_TOO_SOON_MESSAGE =
	'A new code isn’t ready for that address yet. Give it a moment and try again.'

/** The passcode email could not be sent. */
export const PASSCODE_SEND_FAILED_MESSAGE = 'We couldn’t send your code. Give it another go.'

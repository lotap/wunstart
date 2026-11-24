/**
 * Auth copy shared across the domain.
 *
 * This is the supported import surface for server fns and subfolders. A
 * message emitted only by one subfolder lives in that subfolder’s
 * `_messages.ts` (`strategies/email/`, `strategies/password/`, `tokens/`),
 * which is not an external import surface. This file holds copy emitted by
 * domain-root modules or shared across sub-scopes; promote a message here when
 * a second scope needs it. Audit causes, parameter guards, internal state-error
 * text, and log text are diagnostics and stay at the branch.
 */

/**
 * Neutral failure shared by post-auth flows that intentionally use the same
 * copy. Every sensitive branch within a flow must still return this one
 * message; pre-auth flows keep their own wording.
 */
export const GENERIC_AUTH_FAILURE_MESSAGE = 'Something went wrong. Please try again.'

/** The durable auth attempt allowance denied an unauthenticated credential presentation. */
export const AUTH_ATTEMPT_ALLOWANCE_EXHAUSTED_MESSAGE =
	'Too many attempts. Give it a few minutes and try again.'

/** The sudo lease behind a protected action has lapsed. */
export const VERIFICATION_EXPIRED_MESSAGE =
	'Your verification has expired. Re-verify, then try again.'

/** An anon identity outlived the row behind it; the cookie must be replaced. */
export const ANON_SESSION_EXPIRED_MESSAGE = 'Your session expired. Refresh the page and try again.'

/** Sign-up found the email already attached to an account. */
export const EMAIL_ALREADY_REGISTERED_MESSAGE =
	'That email already has an account. Try signing in instead.'

/** Email change targeted the address already on the account. */
export const EMAIL_UNCHANGED_MESSAGE = 'That is already your email address.'

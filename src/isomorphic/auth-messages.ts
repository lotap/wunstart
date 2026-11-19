/**
 * Client-safe auth copy shared by the ops and the UI.
 *
 * The client uses these exact strings to recognize failures where the request
 * has no usable identity, so the copies must not drift.
 */

/** The refresh session behind the request is invalid, expired, or revoked. */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Sign in and try again.'

/** A protected request was made without a usable identity. */
export const SIGN_IN_REQUIRED_MESSAGE = 'You need to sign in to do that.'

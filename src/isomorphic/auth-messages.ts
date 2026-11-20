/**
 * Client-safe auth copy shared by the ops and the UI.
 *
 * One constant is a recognition contract with the client, the other is display
 * copy. Keep the distinction explicit so a matcher and a message are never
 * treated as interchangeable.
 */

/**
 * The client-recognized contract for a dead or unusable refresh session: the
 * recovery hook matches this exact string to drop the cached identity. Change
 * it only together with that matcher.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Sign in and try again.'

/**
 * Display copy for a protected request that carried no usable identity (401).
 * The rejection cannot prove the cookie pair was ended, so the client must not
 * recognize it as a dead session.
 */
export const SIGN_IN_REQUIRED_MESSAGE = 'You need to sign in to do that.'

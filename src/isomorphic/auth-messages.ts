/**
 * Client-safe auth copy shared by the ops and the UI.
 *
 * `SESSION_EXPIRED_MESSAGE` is a recognition contract with the client; the
 * other constants are display copy. Only a path that ends the cookie pair may
 * use the recognition string, so a matcher and a message are never treated as
 * interchangeable.
 */

/**
 * The client-recognized contract for a dead refresh session whose cookie pair
 * the server ends (or clears at the boundary). `useDeadSessionRecovery` matches
 * this exact string to drop the cached identity. Use it only on paths that end
 * the pair, and change it only together with that matcher.
 */
export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Sign in and try again.'

/**
 * Message for a refresh the ban pipeline refused. The cookie pair is kept so
 * the identity can return once the refusal lifts; never use
 * `SESSION_EXPIRED_MESSAGE` here, because the recovery hook would evict a pair
 * the server deliberately retained.
 */
export const SESSION_REFUSED_MESSAGE = 'Too many attempts. Wait a moment, then try again.'

/**
 * Display copy for the strict all-device sign-out. That handler keeps the cookie
 * pair when the refresh session cannot authorize it, so it must not use
 * `SESSION_EXPIRED_MESSAGE`; a recovery hook on the sign-out path would then
 * evict a pair the server retained.
 */
export const SIGN_OUT_ALL_FAILED_MESSAGE =
	'We couldn’t end all of your sessions. Sign in again, then retry.'

/**
 * Display copy for a protected request that carried no usable identity (401).
 * The rejection cannot prove the cookie pair was ended, so the client must not
 * recognize it as a dead session.
 */
export const SIGN_IN_REQUIRED_MESSAGE = 'You need to sign in to do that.'

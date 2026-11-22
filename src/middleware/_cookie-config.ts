/**
 * Cookie name and scope for the current environment.
 *
 * Production host-only uses `__Host-Http-` (Secure, HttpOnly, Path=/, no
 * Domain). Setting `VITE_COOKIE_DOMAIN` switches to `__Http-` (Secure,
 * HttpOnly; the cookie carries that Domain). Development uses no prefix
 * because both require Secure; the per-branch suffix keeps worktrees on
 * `localhost` apart.
 */

/** Domain attribute for auth and Anon cookies; undefined keeps them host-only. */
export const cookieDomain = import.meta.env.PROD
	? import.meta.env.VITE_COOKIE_DOMAIN || undefined
	: undefined

const devSuffix = import.meta.env.PROD ? undefined : import.meta.env.VITE_COOKIE_SUFFIX

/** Build a cookie name for the current environment. */
export const cookieName = (base: string) => {
	if (!import.meta.env.PROD) return devSuffix ? `${base}-${devSuffix}` : base

	if (cookieDomain) return `__Http-${base}`

	return `__Host-Http-${base}`
}

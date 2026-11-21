/**
 * Cookie name and scope for the current environment.
 *
 * Production defaults to host-only `__Host-Http-` cookies: the `__Host-` prefix
 * requires `Secure`, `Path=/`, and no `Domain`, so the cookie is sent only to
 * the host that set it. The app also sets `HttpOnly`. Setting
 * `VITE_COOKIE_DOMAIN` in a production build opts into subdomain sharing: names
 * switch to `__Http-` and the cookie carries that `Domain`, so every subdomain
 * under it can set it.
 *
 * Cookies are scoped by domain and path, not port, so every worktree on
 * `localhost` would otherwise share the same auth cookies. In dev, append the
 * per-branch suffix written by `branch-env` so the browser never sends another
 * worktree's identity; no cookie domain is needed.
 */
const configuredDomain = import.meta.env.VITE_COOKIE_DOMAIN || undefined

/** Production subdomain-sharing opt-in. */
const sharedScope = import.meta.env.PROD && configuredDomain !== undefined

/** Domain attribute for the cookie; host-only mode omits it. */
export const cookieDomain = sharedScope ? configuredDomain : undefined

const devSuffix = import.meta.env.DEV ? (import.meta.env.VITE_COOKIE_SUFFIX ?? '') : ''

const cookiePrefix = () => {
	if (!import.meta.env.PROD) return ''

	return sharedScope ? '__Http-' : '__Host-Http-'
}

/** Anon cookie lifetime; the browser drops the identity after it. */
export const ANON_COOKIE_WEEKS = 8

/** Build a cookie name for the current environment. */
export const cookieName = (base: string) => {
	const prefixed = `${cookiePrefix()}${base}`

	return devSuffix ? `${prefixed}-${devSuffix}` : prefixed
}

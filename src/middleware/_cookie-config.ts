/**
 * Cookie name and scope for the current environment.
 *
 * In production, no configured domain gives host-only `__Host-Http-` cookies;
 * setting `VITE_COOKIE_DOMAIN` gives shared `__Http-` cookies for that domain.
 *
 * Cookies are scoped by domain and path, not port, so every worktree on
 * `localhost` would otherwise share the same auth cookies. In dev, append the
 * per-branch suffix written by `branch-env` so the browser never sends another
 * worktree's identity; no cookie domain is needed.
 */
type CookieScope = {
	readonly prefix: string
	readonly domain: string | undefined
	readonly suffix: string
}

/**
 * The three supported shapes:
 *
 * - production host-only: `__Host-Http-` (Secure, HttpOnly, Path=/, no Domain)
 * - production shared: `__Http-` (Secure, HttpOnly; Domain allowed)
 * - development: no prefix (both prefixes require Secure), branch suffix
 */
const resolveCookieScope = (): CookieScope => {
	if (!import.meta.env.PROD) {
		const devSuffix = import.meta.env.VITE_COOKIE_SUFFIX

		return {
			prefix: '',
			domain: undefined,
			suffix: devSuffix ? `-${devSuffix}` : '',
		}
	}

	const configuredDomain = import.meta.env.VITE_COOKIE_DOMAIN || undefined

	if (configuredDomain) {
		return {prefix: '__Http-', domain: configuredDomain, suffix: ''}
	}

	return {prefix: '__Host-Http-', domain: undefined, suffix: ''}
}

const cookieScope = resolveCookieScope()

/** Domain attribute for auth and Anon cookies; undefined keeps them host-only. */
export const cookieDomain = cookieScope.domain

/** Build a cookie name for the current environment. */
export const cookieName = (base: string) => `${cookieScope.prefix}${base}${cookieScope.suffix}`

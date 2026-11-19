/**
 * Build a cookie name for the current environment.
 *
 * Cookies are scoped by domain and path, not port, so every worktree on
 * `localhost` would otherwise share the same auth cookies. In dev, append the
 * per-branch suffix written by `branch-env` so the browser never sends another
 * worktree's identity. Production keeps the stable names; the `__Http-` prefix
 * rules apply before the suffix.
 */
const devSuffix = import.meta.env.DEV ? (import.meta.env.VITE_COOKIE_SUFFIX ?? '') : ''

export const cookieName = (base: string) => {
	const prefixed = import.meta.env.PROD ? `__Http-${base}` : base

	return devSuffix ? `${prefixed}-${devSuffix}` : prefixed
}

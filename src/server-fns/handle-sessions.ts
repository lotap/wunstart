import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {listSessions} from '#/db/ops/auth/list-sessions.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {clearAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

/**
 * The Settings session list, and the one action that ends a dead session.
 *
 * POST because a dead session makes this clear both auth cookies; the returned
 * list is still the query payload. The method keeps HTTP prefetchers and caches
 * away, but React Query prefetch still runs the query function, so the warning
 * below still applies.
 *
 * This check relies on the list covering every live Session for the User: no
 * `isCurrent` entry then means this device’s refresh session is revoked,
 * expired, or gone. Clearing both auth cookies here ends the zombie identity the
 * access token would otherwise carry for up to 15 minutes; returning `[]` lets
 * the client refresh the router and the guard redirect.
 *
 * A filtered or paginated list must keep the current row in its result, or check
 * liveness separately. Never call this from a loader, router prefetch, or React
 * Query prefetch (`prefetchQuery`, `ensureQueryData`): the cookie clear is a
 * logout, not a cache refresh.
 */
export const handleSessions = createServerFn({method: 'POST'})
	.middleware([requireAuth])
	.handler(
		async ({
			context: {
				auth: {userId, refreshToken},
				ipAddress,
			},
		}) => {
			const sessions = await runOp({
				op: listSessions,
				data: {userId, refreshToken, ipAddress},
				layers: [authLayer, dbLayer],
			})

			const hasCurrentSession = sessions.some((session) => session.isCurrent)

			if (!hasCurrentSession) clearAuthCookies()

			/**
			 * Keep the response a successful `[]`: the client needs it to refresh
			 * the router and let the route guard redirect. It never returns a
			 * Session list to a browser whose own session is dead.
			 */
			return hasCurrentSession ? sessions : []
		},
	)

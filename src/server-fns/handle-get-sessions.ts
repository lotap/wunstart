import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {listSessions} from '#/db/ops/auth/list-sessions.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {clearAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleGetSessions = createServerFn({method: 'GET'})
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

			/**
			 * The list covers every live session for the user, so an empty result
			 * proves the refresh session is revoked, expired, or gone. The access
			 * token keeps working for up to 15 minutes after that, so drop the dead
			 * cookies here instead of leaving a zombie identity. Keep the response a
			 * successful `[]`: the client needs it to refresh the router and let the
			 * route guard redirect.
			 */
			if (!sessions.length) clearAuthCookies()

			return sessions
		},
	)

import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {removeUser} from '#/db/ops/auth/remove-user.ts'
import {runOpClearingDeadSession} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {clearAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleRemoveUser = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.handler(
		async ({
			context: {
				ipAddress,
				userAgent,
				country,
				city,
				region,
				auth: {userId, sudoExpiresAt, refreshToken},
			},
		}) => {
			const {
				anonToken: {token},
			} = await runOpClearingDeadSession({
				op: removeUser,
				data: {userId, sudoExpiresAt, refreshToken, ipAddress, userAgent, country, city, region},
				layers: [authLayer, dbLayer],
			})

			clearAuthCookies()

			setAnonCookie(token)
		},
	)

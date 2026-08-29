import {createServerFn} from '@tanstack/react-start'
import {deleteCookie} from '@tanstack/react-start/server'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {removeUser} from '#/db/ops/auth/remove-user.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {
	ACCESS_TOKEN_COOKIE_NAME,
	authCookiesConfig,
	REFRESH_TOKEN_COOKIE_NAME,
} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleRemoveUser = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.handler(
		async ({
			context: {
				ipAddress,
				auth: {userId, sudoExpiresAt},
			},
		}) => {
			const {
				anonToken: {token},
			} = await runOp({
				op: removeUser,
				data: {userId, sudoExpiresAt, ipAddress},
				layers: [authLayer, dbLayer],
			})

			deleteCookie(ACCESS_TOKEN_COOKIE_NAME, authCookiesConfig)
			deleteCookie(REFRESH_TOKEN_COOKIE_NAME, authCookiesConfig)

			setAnonCookie(token)
		},
	)

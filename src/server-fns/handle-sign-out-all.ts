import {createServerFn} from '@tanstack/react-start'
import {deleteCookie} from '@tanstack/react-start/server'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {signOutAll} from '#/db/ops/auth/sign-out-all.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {
	ACCESS_TOKEN_COOKIE_NAME,
	authCookiesConfig,
	REFRESH_TOKEN_COOKIE_NAME,
} from '#/middleware/_set-auth-cookies.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleSignOutAll = createServerFn({method: 'POST'})
	.middleware([requireAuth])
	.handler(
		async ({
			context: {
				auth: {accessToken},
				ipAddress,
			},
		}) => {
			const {
				anonToken: {token},
			} = await runOp({
				op: signOutAll,
				data: {accessToken, ipAddress},
				layers: [authLayer, dbLayer],
			})

			deleteCookie(ACCESS_TOKEN_COOKIE_NAME, authCookiesConfig)
			deleteCookie(REFRESH_TOKEN_COOKIE_NAME, authCookiesConfig)

			setAnonCookie(token)
		},
	)

import {createServerFn} from '@tanstack/react-start'
import {deleteCookie} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {passwordChange} from '#/db/ops/auth/password-change.ts'
import {emailLayer} from '#/email/layer.ts'
import {PasswordChangeCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {
	ACCESS_TOKEN_COOKIE_NAME,
	authCookiesConfig,
	REFRESH_TOKEN_COOKIE_NAME,
} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handlePasswordChange = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(PasswordChangeCredentials))
	.handler(
		async ({
			data,
			context: {
				ipAddress,
				userAgent,
				country,
				auth: {userId, sudoExpiresAt},
			},
		}) => {
			const {anonToken} = await runOp({
				op: passwordChange,
				data: {input: data, ipAddress, userAgent, country, userId, sudoExpiresAt},
				layers: [authLayer, dbLayer, emailLayer],
			})

			/**
			 * When requested, all of the user's sessions were archived, including
			 * this request's, so end the local session and fall back to an anon
			 * identity
			 */
			if (anonToken) {
				deleteCookie(ACCESS_TOKEN_COOKIE_NAME, authCookiesConfig)
				deleteCookie(REFRESH_TOKEN_COOKIE_NAME, authCookiesConfig)

				setAnonCookie(anonToken.token)
			}
		},
	)

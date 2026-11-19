import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {signOut} from '#/db/ops/auth/sign-out.ts'
import {isOpsError} from '#/db/ops/ops-error.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {clearAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleSignOut = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.handler(
		async ({
			context: {
				auth: {refreshToken},
				ipAddress,
				userAgent,
				country,
				city,
				region,
			},
		}) => {
			try {
				const {
					anonToken: {token},
				} = await runOp({
					op: signOut,
					data: {token: refreshToken, ipAddress, userAgent, country, city, region},
					layers: [authLayer, dbLayer],
				})

				clearAuthCookies()

				setAnonCookie(token)
			} catch (error) {
				if (!isOpsError(error)) throw error

				const {failureCause} = error.activity

				if (
					failureCause !== 'INVALID_JWS' &&
					failureCause !== 'SESSION_NOT_FOUND' &&
					failureCause !== 'WRONG_NONCE'
				)
					throw error

				/**
				 * The refresh session is already invalid/expired/revoked, or its nonce
				 * no longer matches. Keep the strict behavior on `signOutAll`; here the
				 * local sign-out is still complete once the dead auth cookies are gone.
				 * Do not mint an anon token: `verifyAnon` issues one on the next request.
				 */
				clearAuthCookies()
			}
		},
	)

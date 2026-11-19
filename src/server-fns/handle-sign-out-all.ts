import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {signOutAll} from '#/db/ops/auth/sign-out-all.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {clearAuthCookies} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

/**
 * Strict on purpose, unlike `handleSignOut`: a dead or forged refresh session
 * surfaces an error here instead of clearing cookies locally, so an evicted
 * token cannot masquerade as a successful all-device sign-out. Settings hides
 * the action once no sessions remain.
 */
export const handleSignOutAll = createServerFn({method: 'POST'})
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
			const {
				anonToken: {token},
			} = await runOp({
				op: signOutAll,
				data: {token: refreshToken, ipAddress, userAgent, country, city, region},
				layers: [authLayer, dbLayer],
			})

			clearAuthCookies()

			setAnonCookie(token)
		},
	)

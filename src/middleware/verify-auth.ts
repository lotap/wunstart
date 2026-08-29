import {createMiddleware} from '@tanstack/react-start'
import {deleteCookie, getCookie} from '@tanstack/react-start/server'
import {Schema} from 'effect'
import type {Effect} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {AuthTokenError} from '#/db/ops/auth/token-error.ts'
import type {verifyAccess as verifyAccessOpType} from '#/db/ops/auth/verify-access'
import {RateLimitError} from '#/db/ops/rate-limit-error.ts'
import {emailLayer} from '#/email/layer.ts'

import type {DegradedAuth} from './_degraded-auth.ts'
import {runOp} from './_run-op.server.ts'
import {
	ACCESS_TOKEN_COOKIE_NAME,
	authCookiesConfig,
	REFRESH_TOKEN_COOKIE_NAME,
	setAuthCookies,
} from './_set-auth-cookies.ts'
import {getForwardedIp} from './get-forwarded-ip.ts'
import {KnownServerError} from './sanitize-errors.ts'

/**
 * Status-discriminated: `'authenticated'` with tokens and user data, `'degraded'` when
 * verification could not run (infrastructure outage), `null` when no usable identity
 * was presented.
 */
export type AuthContext = {
	auth:
		| ({
				readonly status: 'authenticated'
				readonly accessToken: string
				readonly refreshToken: string
		  } & Effect.Success<ReturnType<typeof verifyAccessOpType>>)
		| DegradedAuth
		| null
}

export const verifyAuth = createMiddleware()
	.middleware([getForwardedIp])
	.server(async ({next, context: {ipAddress, userAgent}}) => {
		const accessToken = getCookie(ACCESS_TOKEN_COOKIE_NAME)
		const refreshToken = getCookie(REFRESH_TOKEN_COOKIE_NAME)

		if (accessToken && refreshToken) {
			/** Dynamically import verifyAccess op because it relies on injecting env values into the cf worker */
			const {verifyAccess} = await import('#/db/ops/auth/verify-access')

			try {
				const tokenData = await runOp({
					op: verifyAccess,
					data: {token: accessToken, ipAddress},
					layers: [authLayer, dbLayer],
				})

				// SAFETY: tokenData is the server-verified verifyAccess payload; the status
				// discriminator composes it into the authenticated context.
				return next({
					context: {
						auth: {status: 'authenticated', accessToken, refreshToken, ...tokenData},
					} as AuthContext,
				})
			} catch (error) {
				/** 429 from the rate limiter. Propagate untouched */
				if (error instanceof KnownServerError) throw error

				/** Infrastructure failure. Never treat an outage as an invalid token */
				if (!Schema.is(AuthTokenError)(error) && !Schema.is(RateLimitError)(error)) {
					// SAFETY: an outage must not look like an invalid token. Degraded
					// carries no identity data.
					return next({context: {auth: {status: 'degraded'}} as AuthContext})
				}

				/** Invalid or rate-limited access token. Fall through and try the refresh token */
			}
		}

		if (refreshToken) {
			/** Dynamically import refresh op because it relies on cf injected values for hashing */
			const {refresh} = await import('#/db/ops/auth/refresh')

			try {
				const refreshData = await runOp({
					op: refresh,
					data: {token: refreshToken, ipAddress, userAgent},
					layers: [authLayer, dbLayer, emailLayer],
				})

				const {accessTokenExpiresAt, newAccessToken, newRefreshToken, sessionExpiresAt, userId} =
					refreshData

				setAuthCookies({
					access: {token: newAccessToken, exp: accessTokenExpiresAt},
					session: {refreshToken: newRefreshToken, expiresAt: sessionExpiresAt},
				})

				// SAFETY: refreshData is the server-verified refresh payload with the new
				// tokens and the session's user id.
				return next({
					context: {
						auth: {
							status: 'authenticated',
							accessToken: newAccessToken,
							refreshToken: newRefreshToken,
							userId,
						},
					} as AuthContext,
				})
			} catch (error) {
				if (error instanceof KnownServerError) throw error

				/** Definitive invalid token. Sign out, then fall through to anon */
				if (Schema.is(AuthTokenError)(error)) {
					deleteCookie(ACCESS_TOKEN_COOKIE_NAME, authCookiesConfig)
					deleteCookie(REFRESH_TOKEN_COOKIE_NAME, authCookiesConfig)
					// SAFETY: definitive invalid token, so null is the cleared-identity context.
					return next({context: {auth: null} as AuthContext})
				}

				/** Ban/rate-limit rejection. Keep the cookies and fall through to anon */
				if (Schema.is(RateLimitError)(error)) {
					// SAFETY: rate-limited request, so identity is null while the cookies are kept.
					return next({context: {auth: null} as AuthContext})
				}

				/** Infrastructure failure. Keep the cookies and surface the degraded state */
				// SAFETY: an outage must not look like an invalid token. Degraded carries
				// no identity data.
				return next({context: {auth: {status: 'degraded'}} as AuthContext})
			}
		}

		// SAFETY: no tokens presented, so null is the no-identity context.
		return next({context: {auth: null} as AuthContext})
	})

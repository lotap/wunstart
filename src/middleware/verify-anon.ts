import {createMiddleware} from '@tanstack/react-start'
import {getCookie} from '@tanstack/react-start/server'
import {Effect, Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {signAnon} from '#/db/ops/auth/sign-anon.ts'
import {AuthTokenError} from '#/db/ops/auth/token-error.ts'
import type {verifyAnon as verifyAnonOpType} from '#/db/ops/auth/verify-anon.ts'
import {RateLimitError} from '#/db/ops/rate-limit-error.ts'

import type {DegradedAuth} from './_degraded-auth.ts'
import {runOp} from './_run-op.server.ts'
import {ANON_TOKEN_COOKIE_NAME, setAnonCookie} from './_set-anon-cookie.ts'
import {KnownServerError} from './sanitize-errors.ts'
import {verifyAuth} from './verify-auth.ts'

/**
 * Status-discriminated: `'verified'` with anon identity data, `'degraded'` when
 * verification could not run (infrastructure outage), `null` when no anon identity
 * exists (authenticated requests).
 */
export type AnonContext = {
	anon:
		| ({readonly status: 'verified'} & Effect.Success<ReturnType<typeof verifyAnonOpType>>)
		| ({readonly status: 'verified'} & Effect.Success<ReturnType<typeof signAnon>>['payload'])
		| DegradedAuth
		| null
}

export const verifyAnon = createMiddleware({type: 'function'})
	.middleware([verifyAuth])
	.server(async ({next, context: {auth, ipAddress, userAgent}}) => {
		/**
		 * Infrastructure failure upstream. Carry the degraded state through to the anon
		 * context. Never verify or issue anon tokens solely because authentication failed
		 * due to an outage. The request must not look like ordinary anonymous access.
		 */
		if (auth?.status === 'degraded')
			// SAFETY: carry the infrastructure failure through. Degraded carries no
			// identity data.
			return next({context: {anon: {status: 'degraded'}} as AnonContext})

		if (auth) {
			// SAFETY: authenticated requests never get an anon identity.
			return next({context: {anon: null} as AnonContext})
		}

		const anonToken = getCookie(ANON_TOKEN_COOKIE_NAME)

		if (anonToken) {
			/** Dynamically import verifyAnon op because it relies on injecting env values into the cf worker */
			const {verifyAnon: verifyAnonOp} = await import('#/db/ops/auth/verify-anon.ts')

			try {
				const payload = await runOp({
					op: verifyAnonOp,
					data: {token: anonToken, ipAddress},
					layers: [authLayer, dbLayer],
				})

				// SAFETY: payload is the server-verified verifyAnon result; the status
				// discriminator composes it into the verified context.
				return next({context: {anon: {status: 'verified', ...payload}} as AnonContext})
			} catch (error) {
				if (error instanceof KnownServerError) throw error

				/** Infrastructure failure. Surface the degraded state rather than issuing a fresh identity */
				if (!Schema.is(AuthTokenError)(error) && !Schema.is(RateLimitError)(error)) {
					// SAFETY: an outage must not look like an invalid token. Degraded
					// carries no identity data.
					return next({context: {anon: {status: 'degraded'}} as AnonContext})
				}

				/** Invalid or rate-limited anon token. Fall through and issue a fresh one */
			}
		}

		try {
			const result = await runOp({
				op: signAnon,
				data: {ipAddress, userAgent},
				layers: [authLayer, dbLayer],
			})

			setAnonCookie(result.token)

			// SAFETY: result.payload is the freshly-issued signAnon identity; the status
			// discriminator composes it into the verified context.
			return next({context: {anon: {status: 'verified', ...result.payload}} as AnonContext})
		} catch (error) {
			if (error instanceof KnownServerError) throw error

			/** signAnon cannot produce identity failures. Any other failure is infrastructure */
			// SAFETY: an outage must not look like an invalid token. Degraded carries
			// no identity data.
			return next({context: {anon: {status: 'degraded'}} as AnonContext})
		}
	})

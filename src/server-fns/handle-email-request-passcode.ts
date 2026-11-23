import {createServerFn} from '@tanstack/react-start'
import {deleteCookie} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {registerAnon} from '#/db/ops/auth/anons/register-anon.ts'
import {ANON_SESSION_EXPIRED_MESSAGE} from '#/db/ops/auth/messages.ts'
import {
	AnonNotFoundError,
	emailRequestPasscode,
} from '#/db/ops/auth/strategies/email/request-passcode.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/tokens/_anon-token.ts'
import {signAnon} from '#/db/ops/auth/tokens/sign-anon.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailPasscodeIntentCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {
	ANON_TOKEN_COOKIE_NAME,
	anonCookieConfig,
	setAnonCookie,
} from '#/middleware/_set-anon-cookie.ts'
import {throwKnownServerError} from '#/middleware/known-server-error.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAnon} from '#/middleware/require-anon.ts'

export const handleEmailRequestPasscode = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAnon])
	.validator(Schema.toStandardSchemaV1(EmailPasscodeIntentCredentials))
	.handler(async ({data, context: {ipAddress, userAgent, country, city, region, anon}}) => {
		const requestPasscode = (payload: AnonTokenPayloadCustomClaims) =>
			runOp({
				op: emailRequestPasscode,
				data: {
					input: {email: data.email, intent: data.intent},
					anonTokenPayload: payload,
					ipAddress,
				},
				layers: [authLayer, dbLayer, emailLayer],
			})

		let anonTokenPayload: AnonTokenPayloadCustomClaims = anon

		if (!anonTokenPayload.registered) {
			const {payload, token} = await runOp({
				op: registerAnon,
				data: {anonTokenPayload, ipAddress, userAgent, country, city, region},
				layers: [authLayer, dbLayer],
			})

			anonTokenPayload = payload
			setAnonCookie(token)
		}

		try {
			const {expiresAt, resendAvailableAt} = await requestPasscode(anonTokenPayload)

			return {expiresAt, resendAvailableAt}
		} catch (error) {
			if (!Schema.is(AnonNotFoundError)(error)) throw error

			/**
			 * The registered claim outlived its row (cross-database dev cookie, branch
			 * reset, archive race). Mint a fresh identity with a new id — never reuse
			 * the stale one, because the archive retains it — and retry once.
			 */
			const {payload} = await runOp({
				op: signAnon,
				data: {ipAddress, userAgent, country, city, region},
				layers: [authLayer, dbLayer],
			})

			const {payload: registeredPayload, token} = await runOp({
				op: registerAnon,
				data: {anonTokenPayload: payload, ipAddress, userAgent, country, city, region},
				layers: [authLayer, dbLayer],
			})

			setAnonCookie(token)

			try {
				const {expiresAt, resendAvailableAt} = await requestPasscode(registeredPayload)

				return {expiresAt, resendAvailableAt}
			} catch (retryError) {
				if (!Schema.is(AnonNotFoundError)(retryError)) throw retryError

				/**
				 * A second miss is not a loop: drop the identity and ask for a reload.
				 * The 400 is final; `sanitizeErrors` owns the 422 rewrite.
				 */
				deleteCookie(ANON_TOKEN_COOKIE_NAME, anonCookieConfig)
				throwKnownServerError(400, ANON_SESSION_EXPIRED_MESSAGE)
			}
		}
	})

import {createServerFn} from '@tanstack/react-start'
import {deleteCookie, setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {ANON_SESSION_EXPIRED_MESSAGE} from '#/db/ops/auth/_messages.ts'
import {emailRequestPasscode} from '#/db/ops/auth/email/request-passcode.ts'
import {registerAnon} from '#/db/ops/auth/register-anon.ts'
import {signAnon} from '#/db/ops/auth/sign-anon.ts'
import {isOpsError} from '#/db/ops/ops-error.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailPasscodeIntentCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {
	ANON_TOKEN_COOKIE_NAME,
	anonCookieConfig,
	setAnonCookie,
} from '#/middleware/_set-anon-cookie.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAnon} from '#/middleware/require-anon.ts'
import {KnownServerError} from '#/middleware/sanitize-errors.ts'

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
			const {expiresAt} = await requestPasscode(anonTokenPayload)

			return {expiresAt}
		} catch (error) {
			if (!isOpsError(error) || error.activity.failureCause !== 'ANON_NOT_FOUND') throw error

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
				const {expiresAt} = await requestPasscode(registeredPayload)

				return {expiresAt}
			} catch (retryError) {
				if (!isOpsError(retryError) || retryError.activity.failureCause !== 'ANON_NOT_FOUND')
					throw retryError

				/** A second miss is not a loop: drop the identity and ask for a reload */
				deleteCookie(ANON_TOKEN_COOKIE_NAME, anonCookieConfig)
				setResponseStatus(400)
				throw new KnownServerError({
					message: ANON_SESSION_EXPIRED_MESSAGE,
				})
			}
		}
	})

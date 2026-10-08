import {createServerFn} from '@tanstack/react-start'
import {DateTime, Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailRequestPasscode} from '#/db/ops/auth/email/request-passcode.ts'
import {registerAnon} from '#/db/ops/auth/register-anon.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'
import {KnownServerError} from '#/middleware/sanitize-errors.ts'

/**
 * Request a verification code for a new email address
 * - re-checks sudo at confirm time.
 * - row is keyed by the new email + userId
 * - reuses the `reverify` intent (recipient checks skipped, sign-in copy)
 * - A taken address fails generically at confirm time, so nothing here leaks registration
 */
export const handleEmailRequestPasscodeForEmailChange = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(EmailCredentials))
	.handler(
		async ({data: {email}, context: {ipAddress, userAgent, country, city, region, auth, anon}}) => {
			const {sudoExpiresAt} = auth
			if (!sudoExpiresAt || DateTime.isPastUnsafe(sudoExpiresAt))
				throw new KnownServerError({
					message: 'Your verification has expired. Re-verify, then try again.',
				})

			let anonTokenPayload: AnonTokenPayloadCustomClaims | null = anon

			if (anonTokenPayload && !anonTokenPayload.registered) {
				const {payload, token} = await runOp({
					op: registerAnon,
					data: {anonTokenPayload, ipAddress, userAgent, country, city, region},
					layers: [authLayer, dbLayer],
				})
				anonTokenPayload = payload
				setAnonCookie(token)
			}

			const {expiresAt} = await runOp({
				op: emailRequestPasscode,
				data: {
					input: {email, intent: 'reverify'},
					anonTokenPayload,
					ipAddress,
					userId: auth.userId,
				},
				layers: [authLayer, dbLayer, emailLayer],
			})

			return {expiresAt}
		},
	)

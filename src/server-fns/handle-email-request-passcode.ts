import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailRequestPasscode} from '#/db/ops/auth/email/request-passcode.ts'
import {registerAnon} from '#/db/ops/auth/register-anon.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailPasscodeIntentCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'

export const handleEmailRequestPasscode = createServerFn({method: 'POST'})
	.middleware([rateLimit])
	.validator(Schema.toStandardSchemaV1(EmailPasscodeIntentCredentials))
	.handler(async ({data, context: {ipAddress, userAgent, country, city, region, auth, anon}}) => {
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
				input: {email: data.email, intent: data.intent},
				anonTokenPayload,
				ipAddress,
				userId: auth?.userId,
			},
			layers: [authLayer, dbLayer, emailLayer],
		})

		return {expiresAt}
	})

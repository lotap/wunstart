import {createServerFn} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailRequestVerification} from '#/db/ops/auth/email/request-verification.ts'
import {registerAnon} from '#/db/ops/auth/register-anon.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailRequestVerificationCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {KnownServerError} from '#/middleware/sanitize-errors.ts'

export const handleEmailRequestVerification = createServerFn({method: 'POST'})
	.middleware([rateLimit])
	.validator(Schema.toStandardSchemaV1(Schema.optional(EmailRequestVerificationCredentials)))
	.handler(async ({data, context: {ipAddress, auth, anon}}) => {
		if (!auth && !data) {
			setResponseStatus(400)
			throw new KnownServerError({message: 'Missing credentials'})
		}

		let anonTokenPayload: AnonTokenPayloadCustomClaims | null = anon

		if (anonTokenPayload && !anonTokenPayload.registered) {
			const {payload, token} = await runOp({
				op: registerAnon,
				data: {anonTokenPayload, ipAddress},
				layers: [authLayer, dbLayer],
			})
			anonTokenPayload = payload
			setAnonCookie(token)
		}

		const {expiresAt} = await runOp({
			op: emailRequestVerification,
			data: {
				input: {email: data?.email, expectRegisteredRecipient: data?.expectRegisteredRecipient},
				anonTokenPayload,
				ipAddress,
				userId: auth?.userId,
			},
			layers: [authLayer, dbLayer, emailLayer],
		})

		return {expiresAt}
	})

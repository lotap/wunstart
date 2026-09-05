import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailRequestPasscode} from '#/db/ops/auth/email/request-passcode.ts'
import {registerAnon} from '#/db/ops/auth/register-anon.ts'
import {emailLayer} from '#/email/layer.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAnonCookie} from '#/middleware/_set-anon-cookie.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

/** The address is derived server-side from the session; the client sends no input */
export const handleEmailRequestPasscodeFromSession = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.handler(async ({context: {ipAddress, userAgent, country, city, region, auth, anon}}) => {
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
				input: {intent: 'reverify'},
				anonTokenPayload,
				ipAddress,
				userId: auth.userId,
			},
			layers: [authLayer, dbLayer, emailLayer],
		})

		return {expiresAt}
	})

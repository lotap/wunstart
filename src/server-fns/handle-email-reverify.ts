import {createServerFn} from '@tanstack/react-start'
import {DateTime, Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailReverify} from '#/db/ops/auth/strategies/email/reverify.ts'
import {PasscodeCredentials} from '#/isomorphic/validations/auth.ts'
import {runOpClearingDeadSession} from '#/middleware/_run-op.server.ts'
import {setAccessTokenCookie} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleEmailReverify = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(PasscodeCredentials))
	.handler(
		async ({
			data,
			context: {
				ipAddress,
				auth: {userId, refreshToken},
			},
		}) => {
			const {token, exp, sudoExpiresAt} = await runOpClearingDeadSession({
				op: emailReverify,
				data: {input: data, ipAddress, userId, refreshToken},
				layers: [authLayer, dbLayer],
			})

			setAccessTokenCookie({token, exp})

			return {sudoExpiresAt: DateTime.toDate(sudoExpiresAt)}
		},
	)

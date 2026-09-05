import {createServerFn} from '@tanstack/react-start'
import {DateTime, Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {passwordReverify} from '#/db/ops/auth/password-reverify.ts'
import {PasswordCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {setAccessTokenCookie} from '#/middleware/_set-auth-cookies.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handlePasswordReverify = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(PasswordCredentials))
	.handler(
		async ({
			data,
			context: {
				ipAddress,
				auth: {userId},
			},
		}) => {
			const {token, exp, sudoExpiresAt} = await runOp({
				op: passwordReverify,
				data: {input: data, ipAddress, userId},
				layers: [authLayer, dbLayer],
			})

			setAccessTokenCookie({token, exp})

			return {sudoExpiresAt: DateTime.toDate(sudoExpiresAt)}
		},
	)

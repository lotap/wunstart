import {createServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailChange} from '#/db/ops/auth/email-change.ts'
import {emailLayer} from '#/email/layer.ts'
import {EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleEmailChange = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.validator(Schema.toStandardSchemaV1(EmailPasscodeCredentials))
	.handler(
		async ({
			data,
			context: {
				ipAddress,
				userAgent,
				country,
				city,
				region,
				timezone,
				auth: {userId, sudoExpiresAt},
			},
		}) => {
			return await runOp({
				op: emailChange,
				data: {
					input: data,
					ipAddress,
					userAgent,
					country,
					city,
					region,
					timezone,
					userId,
					sudoExpiresAt,
				},
				layers: [authLayer, dbLayer, emailLayer],
			})
		},
	)

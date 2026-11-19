import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {emailRequestPasscode} from '#/db/ops/auth/email/request-passcode.ts'
import {emailLayer} from '#/email/layer.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {rateLimit} from '#/middleware/rate-limit.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

/** The address is derived server-side from the session; the client sends no input */
export const handleEmailRequestPasscodeFromSession = createServerFn({method: 'POST'})
	.middleware([rateLimit, requireAuth])
	.handler(async ({context: {ipAddress, auth}}) => {
		const {expiresAt} = await runOp({
			op: emailRequestPasscode,
			data: {
				input: {intent: 'reverify'},
				anonTokenPayload: null,
				ipAddress,
				userId: auth.userId,
			},
			layers: [authLayer, dbLayer, emailLayer],
		})

		return {expiresAt}
	})

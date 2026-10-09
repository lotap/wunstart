import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {getUserEmail} from '#/db/ops/auth/get-user-email.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

/**
 * Serves the full email address, sudo-gated. The profile endpoint only ever
 * returns the masked form; this is the single privileged path to the real one
 */
export const handleGetUserEmail = createServerFn({method: 'GET'})
	.middleware([requireAuth])
	.handler(
		async ({
			context: {
				auth: {userId, sudoExpiresAt},
				ipAddress,
			},
		}) => {
			return await runOp({
				op: getUserEmail,
				data: {userId, sudoExpiresAt, ipAddress},
				layers: [authLayer, dbLayer],
			})
		},
	)

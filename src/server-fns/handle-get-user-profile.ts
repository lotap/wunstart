import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {getUserProfile} from '#/db/ops/auth/get-user-profile.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleGetUserProfile = createServerFn({method: 'GET'})
	.middleware([requireAuth])
	.handler(
		async ({
			context: {
				auth: {userId},
				ipAddress,
			},
		}) => {
			return await runOp({
				op: getUserProfile,
				data: {userId, ipAddress},
				layers: [authLayer, dbLayer],
			})
		},
	)

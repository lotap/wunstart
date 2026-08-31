import {createServerFn} from '@tanstack/react-start'

import {dbLayer} from '#/db/index.ts'
import {authLayer} from '#/db/ops/auth/_auth-layer.ts'
import {listSessions} from '#/db/ops/auth/list-sessions.ts'
import {runOp} from '#/middleware/_run-op.server.ts'
import {requireAuth} from '#/middleware/require-auth.ts'

export const handleGetSessions = createServerFn({method: 'GET'})
	.middleware([requireAuth])
	.handler(
		async ({
			context: {
				auth: {userId},
				ipAddress,
			},
		}) => {
			return await runOp({
				op: listSessions,
				data: {userId, ipAddress},
				layers: [authLayer, dbLayer],
			})
		},
	)

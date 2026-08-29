import {createStart, createCsrfMiddleware} from '@tanstack/react-start'

import {rejectDegradedAuth} from './middleware/_degraded-auth.ts'
import {createRateLimit} from './middleware/rate-limit.ts'
import {sanitizeErrors} from './middleware/sanitize-errors.ts'
import {verifyAnon} from './middleware/verify-anon.ts'

const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
	requestMiddleware: [csrfMiddleware, sanitizeErrors],
	functionMiddleware: [createRateLimit(150), verifyAnon, rejectDegradedAuth],
}))

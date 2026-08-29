import {createMiddleware} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import type {GlobalServerFnContext} from '#/start-types.ts'

import {KnownServerError} from './sanitize-errors.ts'

/**
 * The degraded context state: identity verification could not run due to an infrastructure
 * problem. Auth/anon contexts are status-discriminated as `'authenticated'`, `'verified'`,
 * or `'degraded'`, with `null` for no identity.
 */
const DegradedAuthSchema = Schema.Struct({status: Schema.Literal('degraded')})

export type DegradedAuth = (typeof DegradedAuthSchema)['Type']

const isDegradedAuth = Schema.is(DegradedAuthSchema)

const reject = () => {
	setResponseStatus(503)
	throw new KnownServerError({
		message: 'We hit a temporary snag on our end. Please try again in a moment.',
	})
}

/**
 * Global function middleware, registered after `verifyAnon` in `start.ts`. Rejects
 * requests whose auth/anon verification degraded with a 503-safe message before any
 * server function runs. Protected server functions never see the degraded state and
 * never have to handle it themselves.
 */
export const rejectDegradedAuth = createMiddleware({type: 'function'}).server(
	async ({next, context}) => {
		const ctx: unknown = context
		// SAFETY: standalone `function` middlewares can't declare their context type,
		// only chained `.middleware([...])` can. The global registry in start.ts always
		// runs this after verifyAuth/verifyAnon have populated the verified context.
		// The framework types the standalone context as `undefined`, so it is widened
		// to `unknown` before the single assertion.
		const {auth, anon} = ctx as GlobalServerFnContext

		if (isDegradedAuth(anon) || isDegradedAuth(auth)) reject()

		return next({context: {auth, anon}})
	},
)

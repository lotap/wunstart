import {createMiddleware} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'

import type {GlobalServerFnContext} from '#/start-types.ts'

import {KnownServerError} from './sanitize-errors.ts'

export const requireAuth = createMiddleware({type: 'function'}).server(async ({next, context}) => {
	const ctx: unknown = context
	// SAFETY: standalone `function` middlewares can't declare their context type,
	// only chained `.middleware([...])` can. The global registry in start.ts provides
	// the verified context, where `verifyAuth` verified the auth and degraded requests
	// were already rejected. The framework types the standalone context as `undefined`,
	// so it is widened to `unknown` before the single assertion.
	const {auth} = ctx as GlobalServerFnContext
	if (!auth) {
		setResponseStatus(401)
		throw new KnownServerError({message: 'You need to sign in to do that.'})
	}

	return next({context: {auth}})
})

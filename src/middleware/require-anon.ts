import {createMiddleware} from '@tanstack/react-start'

import type {GlobalServerFnContext} from '#/start-types.ts'

import {throwKnownServerError} from './known-server-error.ts'

/** Shared with `requireAnonRegistered`, which rejects authenticated requests the same way. */
export const ALREADY_SIGNED_IN_MESSAGE = 'You’re already signed in. Refresh the page to continue.'

export const requireAnon = createMiddleware({type: 'function'}).server(async ({next, context}) => {
	const ctx: unknown = context
	// SAFETY: standalone `function` middlewares can't declare their context type,
	// only chained `.middleware([...])` can. The global registry in start.ts provides
	// the verified context, where `verifyAnon` verified the anon and degraded requests
	// were already rejected. The framework types the standalone context as `undefined`,
	// so it is widened to `unknown` before the single assertion.
	const {anon} = ctx as GlobalServerFnContext

	if (!anon) throwKnownServerError(400, ALREADY_SIGNED_IN_MESSAGE)

	return next({context: {anon}})
})

import {createMiddleware} from '@tanstack/react-start'

import {SIGN_IN_REQUIRED_MESSAGE} from '#/isomorphic/auth-messages.ts'
import type {GlobalServerFnContext} from '#/start-types.ts'

import {throwKnownServerError} from './sanitize-errors.ts'

export const requireAuth = createMiddleware({type: 'function'}).server(async ({next, context}) => {
	const ctx: unknown = context
	// SAFETY: standalone `function` middlewares can't declare their context type,
	// only chained `.middleware([...])` can. The global registry in start.ts provides
	// the verified context, where `verifyAuth` verified the auth and degraded requests
	// were already rejected. The framework types the standalone context as `undefined`,
	// so it is widened to `unknown` before the single assertion.
	const {auth} = ctx as GlobalServerFnContext

	/**
	 * Report the request state; `requireAuth` does not end cookies. `verifyAuth`
	 * has already ended the pair when it saw a definitively invalid token, and
	 * deliberately keeps it when a ban or rate limit refused the refresh,
	 * because the Session behind it may still be alive. The client cannot tell
	 * those states apart from this rejection, so the 401 must not be read as
	 * proof that the cookies are dead.
	 */
	if (!auth) throwKnownServerError(401, SIGN_IN_REQUIRED_MESSAGE)

	return next({context: {auth}})
})

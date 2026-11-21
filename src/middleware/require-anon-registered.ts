import {createMiddleware} from '@tanstack/react-start'

import type {GlobalServerFnContext} from '#/start-types.ts'

import {throwKnownServerError} from './known-server-error.ts'
import {ALREADY_SIGNED_IN_MESSAGE} from './require-anon.ts'

export const requireAnonRegistered = createMiddleware({type: 'function'}).server(
	async ({next, context}) => {
		const ctx: unknown = context
		// SAFETY: standalone `function` middlewares can't declare their context type,
		// only chained `.middleware([...])` can. The global registry in start.ts provides
		// the verified context, where `verifyAnon` verified the anon and degraded requests
		// were already rejected. The framework types the standalone context as `undefined`,
		// so it is widened to `unknown` before the single assertion.
		const {anon} = ctx as GlobalServerFnContext

		/** Authenticated requests have no anon identity; the verified passcode flow is anon-only. */
		if (!anon) throwKnownServerError(400, ALREADY_SIGNED_IN_MESSAGE)

		if (!anon.registered)
			throwKnownServerError(
				400,
				'This code may have been requested in another browser. Request a new code here.',
			)

		return next({context: {anon}})
	},
)

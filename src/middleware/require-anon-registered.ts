import {createMiddleware} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'

import type {GlobalServerFnContext} from '#/start-types.ts'

import {KnownServerError} from './sanitize-errors.ts'

export const requireAnonRegistered = createMiddleware({type: 'function'}).server(
	async ({next, context}) => {
		const ctx: unknown = context
		// SAFETY: standalone `function` middlewares can't declare their context type,
		// only chained `.middleware([...])` can. The global registry in start.ts provides
		// the verified context, where `verifyAnon` verified the anon and degraded requests
		// were already rejected. The framework types the standalone context as `undefined`,
		// so it is widened to `unknown` before the single assertion.
		const {anon} = ctx as GlobalServerFnContext
		if (!anon?.registered) {
			setResponseStatus(400)
			throw new KnownServerError({
				message: 'Something went wrong. Please refresh the page and try again.',
			})
		}

		return next({context: {anon}})
	},
)

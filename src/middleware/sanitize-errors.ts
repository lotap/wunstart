import {createMiddleware} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {isOpsError} from '#/db/ops/ops-error.ts'

/** Tagged error for known server errors that should surface to the client */
export class KnownServerError extends Schema.TaggedErrorClass<KnownServerError>()(
	'KnownServerError',
	{
		message: Schema.String,
	},
) {}

export const sanitizeErrors = createMiddleware().server(async ({next}) => {
	try {
		return await next()
	} catch (error) {
		/**
		 * Ops errors conform to the ops-error contract: their message is
		 * client-safe and their cause is retained for diagnostics.
		 * `OpsError` and `RateLimitError` instances satisfy the same shape, so
		 * this single branch covers them too.
		 */
		if (isOpsError(error)) {
			setResponseStatus(422)
			throw new Error(error.message, {cause: error})
		}

		if (Schema.is(KnownServerError)(error)) throw new Error(error.message, {cause: error})

		throw new Error('Something went wrong on our end. Please try again later.', {cause: error})
	}
})

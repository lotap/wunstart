import {createMiddleware} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {isOpsError} from '#/db/ops/ops-error.ts'

/** Boundary copy for a request the app cannot serve at all. */
export const SERVICE_UNAVAILABLE_MESSAGE =
	'We hit a temporary snag on our end. Please try again in a moment.'

/** Tagged error for known server errors that should surface to the client */
export class KnownServerError extends Schema.TaggedError<
	KnownServerError,
	{readonly brand: unique symbol}
>()('KnownServerError', {
	message: Schema.String,
}) {}

/**
 * Set an HTTP error status and throw the matching `KnownServerError`.
 *
 * Boundary only: ops stay transport-agnostic and use `opsFailure`. The helper
 * never returns, so the status cannot be set without the throw. Declared as a
 * function, not a const arrow: TypeScript only narrows after never-returning
 * calls to function declarations.
 */
export function throwKnownServerError(status: number, message: string): never {
	setResponseStatus(status)
	throw new KnownServerError({message})
}

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

		/**
		 * Status passthrough: this branch sets nothing, so the status the caller
		 * set with `throwKnownServerError` is what the error response carries.
		 * Only an ops error is rewritten to 422.
		 */
		if (Schema.is(KnownServerError)(error)) throw new Error(error.message, {cause: error})

		throw new Error('Something went wrong on our end. Please try again later.', {cause: error})
	}
})

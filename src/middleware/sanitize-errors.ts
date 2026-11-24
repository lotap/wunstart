import {createMiddleware} from '@tanstack/react-start'
import {setResponseStatus} from '@tanstack/react-start/server'
import {Schema} from 'effect'

import {isOpsError} from '#/db/ops/ops-error.ts'

import {KnownServerError} from './known-server-error.ts'

export const sanitizeErrors = createMiddleware().server(async ({next}) => {
	try {
		return await next()
	} catch (error) {
		/**
		 * Ops errors conform to the ops-error contract: their message is
		 * client-safe and their cause is retained for diagnostics. The branch
		 * tests that contract with `isOpsError`, not a class roster, so every
		 * conformer is covered.
		 */
		if (isOpsError(error)) {
			setResponseStatus(422)
			throw new Error(error.message, {cause: error})
		}

		/**
		 * The status the caller chose is what the error response carries. Only an
		 * ops error is rewritten to 422.
		 */
		if (Schema.is(KnownServerError)(error)) {
			setResponseStatus(error.status)
			throw new Error(error.message, {cause: error})
		}

		throw new Error('Something went wrong on our end. Please try again later.', {cause: error})
	}
})

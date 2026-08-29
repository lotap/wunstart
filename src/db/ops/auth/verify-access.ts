import {Effect} from 'effect'

import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {extractAccessTokenPayload} from './_access-token.ts'
import {hkdfFailure, isJwtKeyDerivationError} from './_jwt-utils.ts'
import {authTokenFailure} from './token-error.ts'

const _verifyAccess = Effect.fn('verifyAccess')(function* ({token}: {token: string}) {
	const {exp: _exp, ...filteredPayload} = yield* extractAccessTokenPayload(token).pipe(
		Effect.mapError((error) =>
			isJwtKeyDerivationError(error)
				? hkdfFailure(error)
				: authTokenFailure({
						failureCause: 'INVALID_JWE',
						meta: {operation: error.operation},
						rateAllowance: 3,
						message: 'Your session has expired. Sign in and try again.',
					}),
		),
	)

	/** Return the relevant data directly from the payload */
	return filteredPayload
})

/**
 * Verify an access token and return data from its payload
 * Logging success is disabled by default to avoid using any database connections
 */
export const verifyAccess = createOpsFn({
	fn: _verifyAccess,
	label: 'AUTH_VERIFY_ACCESS',
	logOnSuccess: false,
})

import {Effect} from 'effect'

import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {SESSION_EXPIRED_MESSAGE} from '#/isomorphic/auth-messages.ts'

import {extractAccessTokenPayload} from './_access-token.ts'
import {hkdfFailure, isJwtExpiredError, isJwtKeyDerivationError} from './_jwt-utils.ts'
import {authTokenFailure} from './token-error.ts'

const _verifyAccess = Effect.fn('verifyAccess')(function* ({token}: {token: string}) {
	const {exp: _exp, ...filteredPayload} = yield* extractAccessTokenPayload(token).pipe(
		Effect.mapError((error) => {
			if (isJwtKeyDerivationError(error)) return hkdfFailure(error)

			/**
			 * A token past its 15-minute life is genuine, and `verifyAuth` falls
			 * through to the refresh cookie. Charge no ban weight: a slow client
			 * clock or a request in flight across the expiry boundary must not
			 * accumulate toward an IP ban. An invalid JWE stays charged.
			 */
			if (isJwtExpiredError(error))
				return authTokenFailure({
					failureCause: 'EXPIRED_JWE',
					meta: {operation: error.operation},
					rateAllowance: Infinity,
					message: SESSION_EXPIRED_MESSAGE,
				})

			return authTokenFailure({
				failureCause: 'INVALID_JWE',
				meta: {operation: error.operation},
				rateAllowance: 3,
				message: SESSION_EXPIRED_MESSAGE,
			})
		}),
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

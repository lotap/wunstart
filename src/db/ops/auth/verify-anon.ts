import {Effect} from 'effect'

import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {extractAnonTokenPayload} from './_anon-token.ts'
import {hkdfFailure, isJwtKeyDerivationError} from './_jwt-utils.ts'
import {authTokenFailure} from './token-error.ts'

const _verifyAnon = Effect.fn('verifyAnon')(function* ({token}: {token: string}) {
	return yield* extractAnonTokenPayload(token).pipe(
		Effect.mapError((error) =>
			/** Realistically should only happen if the secrets have rotated or someone is trying to spoof the token */
			isJwtKeyDerivationError(error)
				? hkdfFailure(error)
				: authTokenFailure({
						failureCause: 'INVALID_JWS',
						meta: {operation: error.operation},
						// Only matters if logFailure is true
						rateAllowance: 3,
						message: 'We couldn’t verify your session. Refresh the page and try again.',
					}),
		),
	)
})

export const verifyAnon = createOpsFn({
	fn: _verifyAnon,
	label: 'AUTH_VERIFY_ANON',
	logOnSuccess: false,
})

import {Effect} from 'effect'

import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {extractAnonTokenPayload} from './_anon-token.ts'
import {hkdfFailure, isJwtKeyDerivationError, isUnknownKidError} from './_jwt-utils.ts'
import {authTokenFailure} from './token-error.ts'

const _verifyAnon = Effect.fn('verifyAnon')(function* ({token}: {token: string}) {
	return yield* extractAnonTokenPayload(token).pipe(
		Effect.mapError((error) => {
			if (isJwtKeyDerivationError(error)) return hkdfFailure(error)

			/**
			 * An unknown `kid` is treated as a rotated-out secret; a forged header is
			 * indistinguishable, so the request caps are the brake. The caller issues
			 * a fresh Anon. A token with a known `kid` that fails verification stays
			 * charged.
			 */
			if (isUnknownKidError(error))
				return authTokenFailure({
					failureCause: 'UNKNOWN_KID',
					meta: {operation: error.operation},
					rateAllowance: Infinity,
					message: 'We couldn’t verify your session. Refresh the page and try again.',
				})

			return authTokenFailure({
				failureCause: 'INVALID_JWS',
				meta: {operation: error.operation},
				// Only matters if logFailure is true
				rateAllowance: 3,
				message: 'We couldn’t verify your session. Refresh the page and try again.',
			})
		}),
	)
})

export const verifyAnon = createOpsFn({
	fn: _verifyAnon,
	label: 'AUTH_VERIFY_ANON',
	logOnSuccess: false,
})

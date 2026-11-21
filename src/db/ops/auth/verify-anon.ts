import {Effect} from 'effect'

import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {extractAnonTokenPayload} from './_anon-token.ts'
import {hkdfFailure, jwtFailureVerdict} from './_jwt-utils.ts'
import {ANON_TOKEN_FAILURES} from './anon-token-policies.ts'
import {authTokenFailure} from './token-error.ts'

const ANON_VERIFICATION_FAILED_MESSAGE =
	'We couldn’t verify your session. Refresh the page and try again.'

const _verifyAnon = Effect.fn('verifyAnon')(function* ({token}: {token: string}) {
	return yield* extractAnonTokenPayload(token).pipe(
		Effect.mapError((error) => {
			const verdict = jwtFailureVerdict(error)

			if (verdict === 'hkdf') return hkdfFailure(error)

			return authTokenFailure({
				...ANON_TOKEN_FAILURES[verdict],
				meta: {operation: error.operation},
				message: ANON_VERIFICATION_FAILED_MESSAGE,
			})
		}),
	)
})

export const verifyAnon = createOpsFn({
	fn: _verifyAnon,
	label: 'AUTH_VERIFY_ANON',
	logOnSuccess: false,
})

import {Effect} from 'effect'

import {generateAnonToken} from '#/db/ops/auth/_anon-token.ts'

import {createOpsFn} from '../_create-ops-fn.ts'

const _signAnon = Effect.fn('signAnon')(function* ({
	existingData,
	ipAddress,
	userAgent,
}: {
	existingData?: Parameters<typeof generateAnonToken>[0] | null
	ipAddress: string
	userAgent: string
}) {
	const ipAddresses = new Set([...(existingData?.ipAddresses ?? []), ipAddress])
	const userAgents = new Set([...(existingData?.userAgents ?? []), userAgent])

	return yield* generateAnonToken({
		...existingData,
		ipAddresses: [...ipAddresses],
		userAgents: [...userAgents],
	})
})

/**
 * Generate a anon token as an operation
 * There are no expected errors for this activity, so errors will be logged as UNKNOWN
 */
export const signAnon = createOpsFn({
	fn: _signAnon,
	label: 'AUTH_SIGN_ANON',
	logOnSuccess: false,
})

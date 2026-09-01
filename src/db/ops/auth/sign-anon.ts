import {Effect} from 'effect'

import {generateAnonToken} from '#/db/ops/auth/_anon-token.ts'

import {createOpsFn} from '../_create-ops-fn.ts'

const _signAnon = Effect.fn('signAnon')(function* ({
	existingData,
	ipAddress,
	userAgent,
	country,
	city,
	region,
}: {
	existingData?: Parameters<typeof generateAnonToken>[0] | null
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	const ipAddresses = new Set([...(existingData?.ipAddresses ?? []), ipAddress])
	const userAgents = new Set([...(existingData?.userAgents ?? []), userAgent])
	const countries = new Set([...(existingData?.countries ?? []), country])
	const cities = new Set(existingData?.cities ?? [])
	const regions = new Set(existingData?.regions ?? [])

	if (city) cities.add(city)
	if (region) regions.add(region)

	return yield* generateAnonToken({
		...existingData,
		ipAddresses: [...ipAddresses],
		userAgents: [...userAgents],
		countries: [...countries],
		cities: [...cities],
		regions: [...regions],
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

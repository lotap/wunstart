import {Effect} from 'effect'

import {appendUniqueBounded} from '#/db/helpers/array-fns.ts'
import {ANON_METADATA_COOKIE_CAPS, generateAnonToken} from '#/db/ops/auth/_anon-token.ts'

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
	const ipAddresses = appendUniqueBounded(
		existingData?.ipAddresses,
		ipAddress,
		ANON_METADATA_COOKIE_CAPS.ipAddresses,
	)

	const userAgents = appendUniqueBounded(
		existingData?.userAgents,
		userAgent,
		ANON_METADATA_COOKIE_CAPS.userAgents,
	)

	const countries = appendUniqueBounded(
		existingData?.countries,
		country,
		ANON_METADATA_COOKIE_CAPS.countries,
	)

	const cities = appendUniqueBounded(existingData?.cities, city, ANON_METADATA_COOKIE_CAPS.cities)

	const regions = appendUniqueBounded(
		existingData?.regions,
		region,
		ANON_METADATA_COOKIE_CAPS.regions,
	)

	return yield* generateAnonToken({
		...existingData,
		ipAddresses,
		userAgents,
		countries,
		cities,
		regions,
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

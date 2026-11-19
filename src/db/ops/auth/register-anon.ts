import {Effect} from 'effect'

import {appendUniqueBounded} from '#/db/helpers/array-fns.ts'
import * as anonQueries from '#/db/models/anons/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {
	generateAnonToken,
	ANON_METADATA_COOKIE_CAPS,
	type AnonTokenPayloadCustomClaims,
} from './_anon-token.ts'

const _registerAnon = Effect.fn('registerAnon')(function* ({
	anonTokenPayload,
	ipAddress,
	userAgent,
	country,
	city,
	region,
}: {
	anonTokenPayload: AnonTokenPayloadCustomClaims
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	const {
		id,
		ipAddresses: _ipAddresses,
		userAgents: _userAgents,
		countries: _countries,
		cities: _cities,
		regions: _regions,
		createdAt: tokenCreatedAt,
	} = anonTokenPayload

	const ipAddresses = appendUniqueBounded(
		_ipAddresses,
		ipAddress,
		ANON_METADATA_COOKIE_CAPS.ipAddresses,
	)

	const userAgents = appendUniqueBounded(
		_userAgents,
		userAgent,
		ANON_METADATA_COOKIE_CAPS.userAgents,
	)

	const countries = appendUniqueBounded(_countries, country, ANON_METADATA_COOKIE_CAPS.countries)

	const cities = appendUniqueBounded(_cities, city, ANON_METADATA_COOKIE_CAPS.cities)

	const regions = appendUniqueBounded(_regions, region, ANON_METADATA_COOKIE_CAPS.regions)

	yield* anonQueries.insert({
		id,
		tokenCreatedAt,
		ipAddresses,
		userAgents,
		countries,
		cities,
		regions,
	})

	const payload = {
		...anonTokenPayload,
		registered: true,
		ipAddresses,
		userAgents,
		countries,
		cities,
		regions,
	}

	const {token} = yield* generateAnonToken(payload)

	return {
		token,
		payload,
		logging: {anonId: id},
	}
})

export const registerAnon = createOpsFn({
	fn: _registerAnon,
	label: 'AUTH_REGISTER_ANON',
})

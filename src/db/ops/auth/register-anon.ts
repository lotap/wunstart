import {Effect} from 'effect'

import * as anonQueries from '#/db/models/anons/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {generateAnonToken, type AnonTokenPayloadCustomClaims} from './_anon-token.ts'

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

	const ipAddresses = [...new Set([..._ipAddresses, ipAddress])]
	const userAgents = [...new Set([..._userAgents, userAgent])]
	const countries = [...new Set([..._countries, country])]
	const cities = [...new Set(city ? [..._cities, city] : _cities)]
	const regions = [...new Set(region ? [..._regions, region] : _regions)]

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
	}
})

export const registerAnon = createOpsFn({
	fn: _registerAnon,
	label: 'AUTH_REGISTER_ANON',
})

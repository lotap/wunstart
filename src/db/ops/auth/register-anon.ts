import {Effect} from 'effect'

import * as anonQueries from '#/db/models/anons/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {generateAnonToken, type AnonTokenPayloadCustomClaims} from './_anon-token.ts'

const _registerAnon = Effect.fn('registerAnon')(function* ({
	anonTokenPayload,
	ipAddress,
	userAgent,
	country,
}: {
	anonTokenPayload: AnonTokenPayloadCustomClaims
	ipAddress: string
	userAgent: string
	country: string
}) {
	const {
		id,
		ipAddresses: _ipAddresses,
		userAgents: _userAgents,
		countries: _countries,
		createdAt: tokenCreatedAt,
	} = anonTokenPayload

	const ipAddresses = [...new Set([..._ipAddresses, ipAddress])]
	const userAgents = [...new Set([..._userAgents, userAgent])]
	const countries = [...new Set([..._countries, country])]

	yield* anonQueries.insert({id, tokenCreatedAt, ipAddresses, userAgents, countries})

	const payload = {...anonTokenPayload, registered: true, ipAddresses, userAgents, countries}
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

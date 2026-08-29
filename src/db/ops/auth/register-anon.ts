import {Effect} from 'effect'

import * as anonQueries from '#/db/models/anons/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {generateAnonToken, type AnonTokenPayloadCustomClaims} from './_anon-token.ts'

const _registerAnon = Effect.fn('registerAnon')(function* ({
	anonTokenPayload,
	ipAddress,
	userAgent,
}: {
	anonTokenPayload: AnonTokenPayloadCustomClaims
	ipAddress: string
	userAgent: string
}) {
	const {
		id,
		ipAddresses: _ipAddresses,
		userAgents: _userAgents,
		createdAt: tokenCreatedAt,
	} = anonTokenPayload

	const ipAddresses = [...new Set([..._ipAddresses, ipAddress])]
	const userAgents = [...new Set([..._userAgents, userAgent])]

	yield* anonQueries.insert({id, tokenCreatedAt, ipAddresses, userAgents})

	const payload = {...anonTokenPayload, registered: true, ipAddresses, userAgents}
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

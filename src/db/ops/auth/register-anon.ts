import {Effect} from 'effect'

import * as anonQueries from '#/db/models/anons/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'

import {generateAnonToken, type AnonTokenPayloadCustomClaims} from './_anon-token.ts'

const _registerAnon = Effect.fn('registerAnon')(function* ({
	anonTokenPayload,
	ipAddress,
}: {
	anonTokenPayload: AnonTokenPayloadCustomClaims
	ipAddress: string
}) {
	const {id, ipAddresses: _ipAddresses, createdAt: tokenCreatedAt} = anonTokenPayload

	const ipAddresses = [...new Set([..._ipAddresses, ipAddress])]

	yield* anonQueries.insert({id, tokenCreatedAt, ipAddresses})

	const payload = {...anonTokenPayload, registered: true, ipAddresses}
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

import {Effect} from 'effect'

import type {Tx} from '#/db/helpers/types.ts'
import * as anonsCascades from '#/db/models/anons/cascades.ts'
import * as anonsQueries from '#/db/models/anons/queries.ts'

import type {AnonTokenPayloadCustomClaims} from './_anon-token.ts'

/** Send anon to the archive table */
export const retireAnon = Effect.fn('retireAnon')(function* (
	{
		tokenData: {id, createdAt, ipAddresses, registered},
		userId,
		ipAddress,
	}: {
		tokenData: AnonTokenPayloadCustomClaims
		userId: string
		ipAddress: string
	},
	tx?: Tx,
) {
	const newIpAddresses = [...new Set([...ipAddresses, ipAddress])]

	if (registered) {
		const [data] = yield* anonsCascades.archive(
			{id},
			{
				extraData: {
					ipAddresses: newIpAddresses,
					tokenCreatedAt: createdAt,
					userId,
				},
				tx,
			},
		)

		// should be unreachable, drizzle throws on failed insert but it makes the linter happy
		if (!data) return yield* Effect.die(new Error('Problem archiving anon'))

		return data
	}

	const [data] = yield* anonsQueries.archiveInsert(
		{
			id,
			tokenCreatedAt: createdAt,
			ipAddresses: newIpAddresses,
		},
		tx,
	)

	// should be unreachable, drizzle throws on failed insert but it makes the linter happy
	if (!data) return yield* Effect.die(new Error('Problem archiving anon'))

	return data
})

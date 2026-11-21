import {Effect} from 'effect'

import {appendUniqueBounded} from '#/db/helpers/array-fns.ts'
import type {Tx} from '#/db/helpers/types.ts'
import * as anonsCascades from '#/db/models/anons/cascades.ts'
import * as anonsQueries from '#/db/models/anons/queries.ts'

import {ANON_METADATA_COOKIE_CAPS, type AnonTokenPayloadCustomClaims} from './_anon-token.ts'

/** Send anon to the archive table */
export const retireAnon = Effect.fn('retireAnon')(function* (
	{
		tokenData: {id, createdAt, ipAddresses, userAgents, countries, cities, regions, registered},
		userId,
		ipAddress,
		userAgent,
		country,
		city,
		region,
	}: {
		tokenData: AnonTokenPayloadCustomClaims
		userId: string
		ipAddress: string
		userAgent: string
		country: string
		city: string | null
		region: string | null
	},
	tx?: Tx,
) {
	const newIpAddresses = appendUniqueBounded(
		ipAddresses,
		ipAddress,
		ANON_METADATA_COOKIE_CAPS.ipAddresses,
	)

	const newUserAgents = appendUniqueBounded(
		userAgents,
		userAgent,
		ANON_METADATA_COOKIE_CAPS.userAgents,
	)

	const newCountries = appendUniqueBounded(countries, country, ANON_METADATA_COOKIE_CAPS.countries)

	const newCities = appendUniqueBounded(cities, city, ANON_METADATA_COOKIE_CAPS.cities)

	const newRegions = appendUniqueBounded(regions, region, ANON_METADATA_COOKIE_CAPS.regions)

	if (registered) {
		const archived = yield* anonsCascades
			.archive(
				{id},
				{
					extraData: {
						ipAddresses: newIpAddresses,
						userAgents: newUserAgents,
						countries: newCountries,
						cities: newCities,
						regions: newRegions,
						tokenCreatedAt: createdAt,
						userId,
					},
					tx,
				},
			)
			/**
			 * A registered token can outlive its row: a cross-database dev cookie,
			 * a branch reset, or a concurrent archive. Sign-in must not fail for
			 * that, so fall through to the archive rather than rolling back.
			 *
			 * A concurrent archive that loses the delete race raises
			 * `ArchiveCountMismatchError` instead. Callers retry the whole
			 * transaction (`retryTransientOrArchiveRace`), so the next attempt finds the
			 * winner’s row here. An `ArchiveNotFound` means no active row was visible;
			 * if the winner’s archive row is also not visible yet, the fallback insert
			 * appends another row, which the append-only archive allows. Do not catch the
			 * mismatch inside this transaction: the loser’s archive insert would commit
			 * as a duplicate; let the error roll back and be retried by the caller.
			 */
			.pipe(Effect.catchTag('ArchiveNotFoundError', () => Effect.succeed([])))

		const [data] = archived

		if (data) return data

		const [existing] = yield* anonsQueries.archiveSelectByActiveId({id}, tx)

		if (existing) return existing

		yield* Effect.logWarning(
			'Registered anon row missing; archiving from the token’s own metadata',
			id,
		)

		const [fallback] = yield* anonsQueries.archiveInsert(
			{
				id,
				tokenCreatedAt: createdAt,
				ipAddresses: newIpAddresses,
				userAgents: newUserAgents,
				countries: newCountries,
				cities: newCities,
				regions: newRegions,
				userId,
			},
			tx,
		)

		// should be unreachable, drizzle throws on failed insert but it makes the linter happy
		if (!fallback) return yield* Effect.die(new Error('Problem archiving anon'))

		return fallback
	}

	const [data] = yield* anonsQueries.archiveInsert(
		{
			id,
			tokenCreatedAt: createdAt,
			ipAddresses: newIpAddresses,
			userAgents: newUserAgents,
			countries: newCountries,
			cities: newCities,
			regions: newRegions,
			userId,
		},
		tx,
	)

	// should be unreachable, drizzle throws on failed insert but it makes the linter happy
	if (!data) return yield* Effect.die(new Error('Problem archiving anon'))

	return data
})

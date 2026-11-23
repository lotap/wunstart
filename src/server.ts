import handler from '@tanstack/react-start/server-entry'
import {Effect} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {archiveOldActivities} from '#/db/ops/system/archive-old-activities.ts'
import {purgeAuthAttempts} from '#/db/ops/system/purge-auth-attempts.ts'

export {AuthHasher} from './durable-objects/auth-hasher.ts'

/**
 * Daily cron (06:30 UTC): archives activities past the retention window and
 * drops attempt counters whose window closed.
 */
const scheduled = async () => {
	await Effect.runPromise(
		// Cron entry point: the DB layer is provided once for both runs.
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.all([archiveOldActivities({}), purgeAuthAttempts({})], {
			concurrency: 'unbounded',
		}).pipe(Effect.provide(dbLayer)),
	)
}

export default {fetch: handler.fetch, scheduled}

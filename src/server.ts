import handler from '@tanstack/react-start/server-entry'
import {Effect} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {archiveOldActivities} from '#/db/ops/system/archive-old-activities.ts'

export {AuthHasher} from './durable-objects/auth-hasher.ts'

/** Daily cron (06:30 UTC): archives activities older than 30 days */
export const scheduled = async () => {
	await Effect.runPromise(
		archiveOldActivities({retentionWindow: '30 days'}).pipe(Effect.provide(dbLayer)),
	)
}

export default {fetch: handler.fetch, scheduled}

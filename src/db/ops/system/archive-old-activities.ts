import {Effect} from 'effect'

import {archiveManyOldByCutoff} from '#/db/models/activities/cascades.ts'
import {createSystemOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'

/**
 * Rows archived per transaction. Bounds the select, archive insert, ban cascade
 * update, and delete of each batch so one run cannot grow a transaction (or its
 * memory footprint) with the backlog size.
 */
const ARCHIVE_BATCH_SIZE = 500

const _archiveOldActivities = Effect.fn('archiveOldActivities')(function* ({
	retentionWindow = '30 days',
}: {
	retentionWindow?: string
}) {
	let archivedCount = 0
	let remaining = true

	while (remaining) {
		const archivedRows = yield* archiveManyOldByCutoff({
			cutoff: retentionWindow,
			limit: ARCHIVE_BATCH_SIZE,
		}).pipe(
			Effect.catchTags({
				// No rows, or a count mismatch (a concurrent activity write raced the
				// batch, which rolled back). Stop this run; the next cron picks up
				// whatever remains. Continuing after a mismatch could loop on a batch
				// that keeps racing.
				ArchiveNotFoundError: () => Effect.succeed([]),
				ArchiveCountMismatchError: () => Effect.succeed([]),
			}),
			retryTransientDb,
		)

		archivedCount += archivedRows.length
		/** A short batch means everything past the cutoff has been archived */
		remaining = archivedRows.length === ARCHIVE_BATCH_SIZE
	}

	return {archivedCount}
})

/**
 * Archives activities older than the given retention window, in batches of
 * {@link ARCHIVE_BATCH_SIZE} rows (one transaction per batch).
 *
 * Triggered by the daily cron on Cloudflare Workers (see the `scheduled` handler in src/server.ts)
 * or run directly on other platforms (see src/scripts/archive-old-activities.ts).
 */
export const archiveOldActivities = createSystemOpsFn({
	fn: _archiveOldActivities,
	label: 'SYSTEM_ARCHIVE_OLD_ACTIVITIES',
})

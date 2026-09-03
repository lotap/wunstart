import {createArchiveManyFn} from '#/db/helpers/funcs.ts'
import * as activitiesBansQueries from '#/db/models/activities---bans/queries.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'

/**
 * Archives every activity older than the given cutoff in one transaction, handles related cascades,
 * and removes them from activities. Used by the archive cron job (see archiveOldActivities)
 */
export const archiveManyOldByCutoff = createArchiveManyFn({
	selectFn: queries.selectFromOldByCutoff,
	activeTable,
	archiveTable,
	cascades: (tx, rows, archiveIds) => [
		// createArchiveManyFn keeps rows and archiveIds index-aligned (confirmed at insert time)
		activitiesBansQueries.updateBansForArchivedActivities(
			{
				activityIds: rows.map((row) => row.id),
				archiveIds,
			},
			tx,
		),
	],
})

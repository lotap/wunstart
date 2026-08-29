import {arrayContains, sql} from 'drizzle-orm'

import {createArchiveFn, createArchiveManyFn} from '#/db/helpers/funcs.ts'
import type {Tx} from '#/db/helpers/types.ts'
import * as activitiesBansQueries from '#/db/models/activities---bans/queries.ts'
import {activeTable as bans} from '#/db/models/bans/schemas.ts'

import * as queries from './queries.ts'
import {activeTable, archiveTable} from './schemas.ts'

/**
 * Removes the activity id from every ban referencing it and appends its archive id(s) to the
 * ban's activitiesArchiveIds.
 *
 * Arrays in sql templates expand to row constructors, so the archive ids are joined as individual
 * params inside an explicit ARRAY[...]::bigint[]
 */
const updateBansForArchive = (tx: Tx, activityId: string, archiveIds: bigint[]) =>
	tx
		.update(bans)
		.set({
			activitiesArchiveIds: sql`${bans.activitiesArchiveIds} || ARRAY[${sql.join(
				archiveIds.map((archiveId) => sql`${archiveId}`),
				sql.raw(', '),
			)}]::bigint[]`,
			activityIds: sql`array_remove(${bans.activityIds}, ${activityId})`,
		})
		.where(arrayContains(bans.activityIds, [activityId]))

/** Adds given id to the activitiesArchive, handles related cascades, and removes it from activities */
export const archive = createArchiveFn({
	selectFn: queries.select,
	activeTable,
	archiveTable,
	cascades: (tx, id, archiveIds) => [updateBansForArchive(tx, id, archiveIds)],
})

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

import {asc, eq, getColumns, lte, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'

import {activeTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {id, weight} = getColumns(activeTable)

/// INSERT ///

export const insert = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				anonId: sql.placeholder('anonId'),
				anonsArchiveId: sql.placeholder('anonsArchiveId'),
				userId: sql.placeholder('userId'),
				usersArchiveId: sql.placeholder('usersArchiveId'),
				success: sql.placeholder('success'),
				label: sql.placeholder('label'),
				failureCause: sql.placeholder('failureCause'),
				meta: sql.placeholder('meta'),
				ipAddress: sql.placeholder('ipAddress'),
				failedCredential: sql.placeholder('failedCredential'),
				weight: sql.placeholder('weight'),
			})
			.returning({id, weight})
			.prepare(`${labelPrefix}_insert`),
})

/// SELECT ///

export const select = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(eq(id, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_select`),
})

/**
 * Selects activities older than the cutoff, oldest first, capped at the given limit.
 *
 * The archive cron job pages through with a bounded limit so one run can never
 * select an unbounded backlog into memory or grow its transactions with the
 * table size (see archiveOldActivities).
 */
export const selectFromOldByCutoff = createPreparedQuery({
	vSchema: V.ByCutoff,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(lte(activeTable.timestamp, sql`now() - ${sql.placeholder('cutoff')}::interval`))
			.orderBy(asc(activeTable.timestamp))
			.limit(sql.placeholder('limit'))
			.prepare(`${labelPrefix}_select_from_old_by_cutoff`),
})

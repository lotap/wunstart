import {getColumns, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/query-fns.ts'

import {activeTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {count, windowStart} = getColumns(activeTable)

/// INSERT ///

/**
 * Reserves one presentation for `target`, or reports the allowance as spent.
 *
 * The allowance guard lives in the upsert's own WHERE, so the increment and the
 * decision are one statement: Postgres serializes the conflicting writers and
 * evaluates the condition against the row's current count. A select-then-update
 * would let a concurrent burst all read the same count and reach the hash
 * together. No returned row means denied; a row older than the window restarts
 * at one in the same statement.
 */
export const reserve = createPreparedQuery({
	vSchema: V.Reserve,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				scope: sql.placeholder('scope'),
				target: sql.placeholder('target'),
				count: 1,
			})
			.onConflictDoUpdate({
				target: [activeTable.scope, activeTable.target],
				set: {
					count: sql`CASE
							WHEN ${windowStart} <= now() - ${sql.placeholder('window')}::interval THEN 1
							ELSE ${count} + 1
						END`,
					windowStart: sql`CASE
							WHEN ${windowStart} <= now() - ${sql.placeholder('window')}::interval THEN now()
							ELSE ${windowStart}
						END`,
				},
				setWhere: sql`${windowStart} <= now() - ${sql.placeholder('window')}::interval
						OR ${count} < ${sql.placeholder('allowance')}`,
			})
			.returning({count})
			.prepare(`${labelPrefix}_reserve`),
})

/// DELETE ///

export const deleteByCutoff = createPreparedQuery({
	vSchema: V.ByCutoff,
	stmtFn: (qx) =>
		qx
			.delete(activeTable)
			.where(sql`${windowStart} < now() - ${sql.placeholder('cutoff')}::interval`)
			.returning({scope: activeTable.scope})
			.prepare(`${labelPrefix}_delete_by_cutoff`),
})

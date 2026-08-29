import {eq, getColumns, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'

import {activeTable, archiveTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {id, ipAddresses} = getColumns(activeTable)

/// INSERT ///

export const insert = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				id: sql.placeholder('id'),
				tokenCreatedAt: sql.placeholder('tokenCreatedAt'),
				ipAddresses: sql.placeholder('ipAddresses'),
			})
			.onConflictDoUpdate({
				target: id,
				set: {
					ipAddresses: sql`${ipAddresses} || EXCLUDED.ip_addresses`,
				},
			})
			.returning({id})
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

/// ARCHIVE ///

/// PRIMITIVES ///

const {id: activeId, archiveId} = getColumns(archiveTable)

/// SELECT ///

export const archiveSelectByActiveId = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select({archiveId})
			.from(archiveTable)
			.where(eq(activeId, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_archive_select_by_active_id`),
})

/// INSERT ///

export const archiveInsert = createPreparedQuery({
	vSchema: V.ArchiveInsert,
	stmtFn: (qx) =>
		qx
			.insert(archiveTable)
			.values({
				id: sql.placeholder('id'),
				tokenCreatedAt: sql.placeholder('tokenCreatedAt'),
				ipAddresses: sql.placeholder('ipAddresses'),
			})
			.returning({archiveId})
			.prepare(`${labelPrefix}_archive_insert`),
})

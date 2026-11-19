import {desc, eq, getColumns, sql} from 'drizzle-orm'

import {appendUniqueBoundedSql, createPreparedQuery} from '#/db/helpers/query-fns.ts'

import {activeTable, archiveTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {id, ipAddresses, userAgents, countries, cities, regions} = getColumns(activeTable)

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
				userAgents: sql.placeholder('userAgents'),
				countries: sql.placeholder('countries'),
				cities: sql.placeholder('cities'),
				regions: sql.placeholder('regions'),
			})
			.onConflictDoUpdate({
				target: id,
				set: {
					ipAddresses: appendUniqueBoundedSql(ipAddresses, sql`EXCLUDED.ip_addresses`),
					userAgents: appendUniqueBoundedSql(userAgents, sql`EXCLUDED.user_agents`),
					countries: appendUniqueBoundedSql(countries, sql`EXCLUDED.countries`),
					cities: appendUniqueBoundedSql(cities, sql`EXCLUDED.cities`),
					regions: appendUniqueBoundedSql(regions, sql`EXCLUDED.regions`),
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
			/**
			 * Archive rows are append-only: a replayed cookie or a concurrent
			 * recovery can retire the same anon id more than once, so multiple
			 * rows are valid. Pick the newest relationship deterministically
			 * instead of letting scan order decide which row activity logging
			 * or a retry points at.
			 */
			.orderBy(desc(archiveId))
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
				userAgents: sql.placeholder('userAgents'),
				countries: sql.placeholder('countries'),
				cities: sql.placeholder('cities'),
				regions: sql.placeholder('regions'),
				userId: sql.placeholder('userId'),
			})
			.returning({archiveId})
			.prepare(`${labelPrefix}_archive_insert`),
})

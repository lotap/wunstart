import {eq, getColumns, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'

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
					ipAddresses: sql`${ipAddresses} || EXCLUDED.ip_addresses`,
					userAgents: sql`${userAgents} || EXCLUDED.user_agents`,
					countries: sql`${countries} || EXCLUDED.countries`,
					cities: sql`${cities} || EXCLUDED.cities`,
					regions: sql`${regions} || EXCLUDED.regions`,
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
				userAgents: sql.placeholder('userAgents'),
				countries: sql.placeholder('countries'),
				cities: sql.placeholder('cities'),
				regions: sql.placeholder('regions'),
			})
			.returning({archiveId})
			.prepare(`${labelPrefix}_archive_insert`),
})

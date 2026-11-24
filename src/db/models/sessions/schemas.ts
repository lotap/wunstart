import {sql} from 'drizzle-orm'
import {bigint, inet, smallint, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {ARCHIVE_ID_CONFIG, TIMESTAMPTZ_CONFIG} from '#/db/helpers/column-config.ts'
import {createActiveTable, createArchiveTable} from '#/db/helpers/table-fns.ts'
import {activeTable as users, archiveTable as usersArchive} from '#/db/models/users/schemas.ts'

import {SESSION_EXPIRATION_DAYS} from './consts.ts'

export const tableName = 'sessions'

/** Columns with identical definitions in the active and archive tables */
const baseCols = {
	ipAddresses: inet().notNull().array().notNull(),
	userAgents: text().notNull().array().notNull(),
	countries: text().notNull().array().notNull(),
	cities: text().notNull().array().notNull(),
	regions: text().notNull().array().notNull(),
	refreshGeneration: smallint().notNull().default(0),
}

/** The active sessions table */
export const activeTable = createActiveTable(tableName, {
	...baseCols,
	userId: uuid()
		.notNull()
		.references(() => users.id),
	nonceHash: text().notNull(),
	/**
	 * A default cannot bind a param, so the interval is spliced. Safe because
	 * `SESSION_EXPIRATION_DAYS` is a module constant, never request data
	 */
	expiresAt: timestamp(TIMESTAMPTZ_CONFIG)
		.notNull()
		.default(sql.raw(`now() + '${SESSION_EXPIRATION_DAYS} days'::interval`)),
	graceExpiresAt: timestamp(TIMESTAMPTZ_CONFIG),
	graceToken: text(),
	revokedAt: timestamp(TIMESTAMPTZ_CONFIG),
})

/** The sessions archive table. */
export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	...baseCols,
	userId: uuid().references(() => users.id),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
	expiresAt: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
})

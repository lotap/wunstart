import {bigint, inet, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {ARCHIVE_ID_CONFIG, TIMESTAMPTZ_CONFIG} from '#/db/helpers/consts.ts'
import {createActiveTable, createArchiveTable} from '#/db/helpers/tables.ts'
import {activeTable as users} from '#/db/models/users/schemas.ts'
import {archiveTable as usersArchive} from '#/db/models/users/schemas.ts'

export const tableName = 'anons'

/** Columns with identical definitions in the active and archive tables */
const baseCols = {
	tokenCreatedAt: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
	ipAddresses: inet().notNull().array().notNull(),
	userAgents: text().notNull().array().notNull(),
	countries: text().notNull().array().notNull(),
}

/** Anons is used for linking pre-authentication sessions with activities and users */
export const activeTable = createActiveTable(tableName, {
	...baseCols,
	id: uuid().primaryKey(), // Do not generate by default. Require explicit input
})

/**
 * Used to keep a record of pre-authentication sessions
 *
 * Entries do not have to come directly from the live table,
 * because anons are created on-the-fly on the server with just a token.
 *
 * If an anon creates an account or signs-in as a user, the relation can be saved to the archive table.
 * Useful for linking the user to the anon's earlier actions in logs and analytics.
 */
export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	...baseCols,
	createdAt: timestamp(TIMESTAMPTZ_CONFIG), // allow null in createdAt
	updatedAt: timestamp(TIMESTAMPTZ_CONFIG), // allow null in updatedAt
	userId: uuid().references(() => users.id),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
})

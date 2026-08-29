import {sql} from 'drizzle-orm'
import {bigint, inet, smallint, text, timestamp, uuid} from 'drizzle-orm/pg-core'

import {ARCHIVE_ID_CONFIG, TIMESTAMPTZ_CONFIG} from '#/db/helpers/consts.ts'
import {createActiveTable, createArchiveTable} from '#/db/helpers/tables.ts'
import {activeTable as users, archiveTable as usersArchive} from '#/db/models/users/schemas.ts'

export const tableName = 'sessions'

/** Columns with identical definitions in the active and archive tables */
const baseCols = {
	ipAddresses: inet().notNull().array().notNull(),
	userAgents: text().notNull().array().notNull(),
	countries: text().notNull().array().notNull(),
	refreshGeneration: smallint().notNull().default(0),
}

/** The active sessions table */
export const activeTable = createActiveTable(tableName, {
	...baseCols,
	userId: uuid()
		.notNull()
		.references(() => users.id),
	nonceHash: text().notNull(),
	expiresAt: timestamp(TIMESTAMPTZ_CONFIG)
		.notNull()
		.default(sql`now() + '30 days'::interval`), // drizzle doesn't allow params in default values
	graceExpiresAt: timestamp(TIMESTAMPTZ_CONFIG),
	graceToken: text(),
	revokedAt: timestamp(TIMESTAMPTZ_CONFIG),
})

/** The sessions archive table. Preserves relations while keeping the users table small and efficient */
export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	...baseCols,
	userId: uuid().references(() => users.id),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
	expiresAt: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
})

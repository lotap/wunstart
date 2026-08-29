import {sql} from 'drizzle-orm'
import {bigint, smallint, text, timestamp, uniqueIndex, uuid, varchar} from 'drizzle-orm/pg-core'

import {ARCHIVE_ID_CONFIG, TIMESTAMPTZ_CONFIG} from '#/db/helpers/consts.ts'
import {createActiveTable, createArchiveTable} from '#/db/helpers/tables.ts'
import {activeTable as anons, archiveTable as anonsArchive} from '#/db/models/anons/schemas.ts'
import {activeTable as users, archiveTable as usersArchive} from '#/db/models/users/schemas.ts'

export const tableName = 'email_verifications'

/** Columns with identical definitions in the active and archive tables */
const baseCols = {
	anonId: uuid().references(() => anons.id),
	userId: uuid().references(() => users.id),
	attempts: smallint().notNull().default(0),
	email: varchar({length: 254}).notNull(),
}

/** The active email_verification table */
export const activeTable = createActiveTable(
	tableName,
	{
		...baseCols,
		passcodeHash: text().notNull(),
		expiresAt: timestamp(TIMESTAMPTZ_CONFIG)
			.notNull()
			.default(sql`now() + '15 minutes'::interval`),
	},
	(t) => [
		uniqueIndex('email_verifications_email_lower_anon_unique').on(sql`lower(${t.email})`, t.anonId),
		uniqueIndex('email_verifications_email_lower_user_unique').on(sql`lower(${t.email})`, t.userId),
	],
)

/** The email_verification archive table. Preserves relations while keeping the active table small and efficient */
export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	...baseCols,
	anonsArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => anonsArchive.archiveId),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
	verifiedAt: timestamp(TIMESTAMPTZ_CONFIG),
})

import {sql} from 'drizzle-orm'
import {text, uniqueIndex, varchar} from 'drizzle-orm/pg-core'

import {createActiveTable, createArchiveTable} from '#/db/helpers/tables.ts'

export const tableName = 'users'

/** The active users table */
export const activeTable = createActiveTable(
	tableName,
	{
		email: varchar({length: 254}).notNull(),
		passwordHash: text(),
	},
	(t) => [uniqueIndex(`${tableName}_email_lower_unique`).on(sql`lower(${t.email})`)],
)

/** The users archive table. Preserves relations while keeping the users table small and efficient */
export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	email: varchar({length: 254}), // nullable so PII can be erased while maintaining a record
})

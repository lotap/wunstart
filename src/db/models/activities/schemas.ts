import {sql} from 'drizzle-orm'
import {
	bigint,
	boolean,
	index,
	inet,
	jsonb,
	smallint,
	text,
	uuid,
	varchar,
} from 'drizzle-orm/pg-core'

import {ARCHIVE_ID_CONFIG} from '#/db/helpers/consts.ts'
import {createActiveLogTable, createArchiveLogTable} from '#/db/helpers/tables.ts'
import {activeTable as anons, archiveTable as anonsArchive} from '#/db/models/anons/schemas.ts'
import {activeTable as users, archiveTable as usersArchive} from '#/db/models/users/schemas.ts'

export const tableName = 'activities'

/** Columns with identical definitions in the active and archive tables */
const baseCols = {
	userId: uuid().references(() => users.id),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
	label: text().notNull(), // Could be an enum, but it gets difficult to manage as ops are added
	success: boolean().notNull(),
	failureCause: text(), // Could be an enum, but it gets difficult to manage as ops are added
	meta: jsonb(),
	failedCredential: varchar({length: 255}),
	anonId: uuid().references(() => anons.id),
	anonsArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => anonsArchive.archiveId),
	ipAddress: inet().notNull(),
}

/** The active activities table */
export const activeTable = createActiveLogTable(
	tableName,
	{
		...baseCols,
		weight: smallint().notNull().default(1),
	},
	(table) => [
		index().on(table.timestamp),
		/**
		 * Composite (not hash): the hot ban-check filters `ip_address = $1 AND
		 * "timestamp" >= now() - window` per subject, so one btree serves both
		 * the equality and the range. ip_address is NOT NULL on every row, so
		 * this index is maintained on every insert, the one place a full index
		 * is warranted, because the IP arm runs on every logged activity
		 */
		index().on(table.ipAddress, table.timestamp),
		/**
		 * Per-target indexes for the filter-first excessive-activity arms. Each
		 * arm aggregates only its subject's rows, which is what keeps the ban
		 * check O(subject) instead of O(global window).
		 *
		 * Partial (`WHERE col IS NOT NULL`) on purpose: these columns are sparse
		 * (a typical activity carries only its ip plus at most one identity), and
		 * Postgres b-trees index NULLs too. The partial predicate lets INSERTs
		 * skip maintenance entirely for NULL rows, so an ip-only write maintains 3
		 * indexes here instead of 7, while the arms' own `isNotNull` guard makes
		 * every query predicate-proof for using them. Composites carry the window
		 * range so each arm is served by one structure, matching the IP arm
		 */
		index()
			.on(table.failedCredential, table.timestamp)
			.where(sql`${table.failedCredential} is not null`),
		index()
			.on(table.userId, table.timestamp)
			.where(sql`${table.userId} is not null`),
		index()
			.on(table.anonId, table.timestamp)
			.where(sql`${table.anonId} is not null`),
		index()
			.on(table.usersArchiveId, table.timestamp)
			.where(sql`${table.usersArchiveId} is not null`),
		index()
			.on(table.anonsArchiveId, table.timestamp)
			.where(sql`${table.anonsArchiveId} is not null`),
		/**
		 * @todo benchmark the existing indexes with common queries. They are based on my best guesses about how the data will be used, but using real performance metrics would be better.
		 */
	],
)

/**
 * The activities archive table. Preserves relations while keeping the activities table small and efficient.
 * Archived automatically by the daily cron job [archiveOld]{@link (file://./../../ops/system/archive-old-activities.ts)}
 */
export const archiveTable = createArchiveLogTable(`${tableName}_archive`, {
	...baseCols,
	weight: smallint().notNull(),
})

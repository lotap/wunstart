import {sql} from 'drizzle-orm'
import {bigint, check, cidr, index, timestamp, unique, uuid, varchar} from 'drizzle-orm/pg-core'

import {ARCHIVE_ID_CONFIG, TIMESTAMPTZ_CONFIG} from '#/db/helpers/column-config.ts'
import {createActiveTable, createArchiveTable} from '#/db/helpers/table-fns.ts'
import {banScopes} from '#/db/models/activities---bans/schemas.ts'
import {activeTable as anons, archiveTable as anonsArchive} from '#/db/models/anons/schemas.ts'
import {PENALTY_INTERVAL_INITIAL} from '#/db/models/bans/consts.ts'
import {activeTable as users, archiveTable as usersArchive} from '#/db/models/users/schemas.ts'

export const tableName = 'bans'

/** Columns with identical definitions in the active and archive tables */
const baseCols = {
	scope: banScopes().notNull(),
	/**
	 * The banned network, and the scope's target column. The exact address that
	 * triggered the ban lives on the linked activities, not here
	 */
	ipNetwork: cidr(),
	failedCredential: varchar({length: 255}),
	// Arrays over join tables for query efficiency (ANY() joins). No FK constraints, because Postgres doesn't support FKs on array types.
	activityIds: uuid().notNull().array(),
	activitiesArchiveIds: bigint(ARCHIVE_ID_CONFIG).notNull().array(),
	anonId: uuid().references(() => anons.id),
	anonsArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => anonsArchive.archiveId),
	userId: uuid().references(() => users.id),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
	/**
	 * Total accumulated weight of every activity appended to this ban (starting
	 * with the excessive window that created it). Drives penalty-extension math
	 * without joining activities
	 */
	totalWeight: bigint(ARCHIVE_ID_CONFIG).notNull().default(BigInt(0)),
}

export const activeTable = createActiveTable(
	tableName,
	{
		...baseCols,
		/**
		 * A default cannot bind a param, so the interval is spliced. Safe because
		 * `PENALTY_INTERVAL_INITIAL` is a module constant, never request data
		 */
		expiresAt: timestamp(TIMESTAMPTZ_CONFIG).default(
			sql.raw(`now() + '${PENALTY_INTERVAL_INITIAL}'::interval`),
		),
	},
	(table) => [
		index().on(table.expiresAt),
		/** Containment joins (@> ARRAY[id]) scan this array. See updateBansForArchivedActivities */
		index().using('gin', table.activityIds),
		/**
		 * One partial index per target column, mirroring the ban pre-check's
		 * active-ban arms (`WHERE col = $x AND expires_at >= now()`). Partial on
		 * the non-null guard so NULL-heavy rows skip maintenance entirely, and
		 * single-column on purpose: the single-target CHECK plus
		 * bans_scope_target_unique guarantee any target lookup matches at
		 * most one row, so expiry filtering comes free from that one heap fetch.
		 *
		 * Bans are usually a handful of rows (sequential scans win), but a
		 * distributed attack can create tens of thousands of distinct-target bans
		 * at once. These indexes fence off that cliff at near-zero write cost,
		 * since only threshold crossings insert here
		 */
		index()
			.on(table.ipNetwork)
			.where(sql`${table.ipNetwork} is not null`),
		index()
			.on(table.failedCredential)
			.where(sql`${table.failedCredential} is not null`),
		index()
			.on(table.userId)
			.where(sql`${table.userId} is not null`),
		index()
			.on(table.anonId)
			.where(sql`${table.anonId} is not null`),
		index()
			.on(table.usersArchiveId)
			.where(sql`${table.usersArchiveId} is not null`),
		index()
			.on(table.anonsArchiveId)
			.where(sql`${table.anonsArchiveId} is not null`),
		/**
		 * One active ban per (scope, target). NULLS NOT DISTINCT makes the
		 * always-null target columns compare equal. Without it a composite UNIQUE
		 * never fires (NULLs are distinct by default and every ban row has exactly
		 * one non-null target). This constraint is the ON CONFLICT arbiter for
		 * concurrent inserts: see insertOrMergeMany in ./queries.ts
		 */
		unique(`${tableName}_scope_target_unique`)
			.on(
				table.scope,
				table.ipNetwork,
				table.failedCredential,
				table.userId,
				table.anonId,
				table.usersArchiveId,
				table.anonsArchiveId,
			)
			.nullsNotDistinct(),
		/** Every ban targets exactly one subject (the scope's target column) */
		check(
			`${tableName}_single_target_check`,
			sql`num_nonnulls(${table.ipNetwork}, ${table.failedCredential}, ${table.userId}, ${table.anonId}, ${table.usersArchiveId}, ${table.anonsArchiveId}) = 1`,
		),
	],
)

export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	...baseCols,
	expiresAt: timestamp(TIMESTAMPTZ_CONFIG),
})

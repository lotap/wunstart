import {and, eq, getColumns, gte, isNotNull, sql} from 'drizzle-orm'
import type {PgColumn} from 'drizzle-orm/pg-core'

import {createQueryFn, createPreparedQuery} from '#/db/helpers/funcs.ts'
import type {QueryExecutor} from '#/db/helpers/types.ts'
import {
	EXCESSIVE_ACTIVITIES_THRESHOLD,
	EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL,
} from '#/db/models/activities/consts.ts'
import {activeTable as activities} from '#/db/models/activities/schemas.ts'
import {activeTable as bans} from '#/db/models/bans/schemas.ts'

import * as V from './validations.ts'

type Source = 'active_bans' | 'excessive_activities'

const {
	failedCredential: activityFailedCredential,
	anonId: activityAnonId,
	anonsArchiveId: activityAnonsArchiveId,
	id: activityId,
	ipAddress: activityIpAddress,
	timestamp: activityTimestamp,
	userId: activityUserId,
	usersArchiveId: activityUsersArchiveId,
	weight: activityWeight,
} = getColumns(activities)

const {
	id: banId,
	ipAddress: banIpAddress,
	failedCredential: banFailedCredential,
	userId: banUserId,
	anonId: banAnonId,
	usersArchiveId: banUsersArchiveId,
	anonsArchiveId: banAnonsArchiveId,
	scope: banScope,
	expiresAt: banExpiresAt,
	totalWeight: banTotalWeight,
} = getColumns(bans)

/** The sliding window every excessive-activity arm aggregates over */
const withinWindow = gte(
	activityTimestamp,
	sql`now() - ${EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL}::interval`,
)

/**
 * One excessive-activity arm: aggregates only rows carrying this specific
 * target within the sliding window. Filter-first is what keeps the ban check
 * O(subject's rows) instead of O(global window). The per-target indexes on
 * activities are what make each arm cheap
 *
 * Non-key target columns are NULL literals: they are not in GROUP BY, and the
 * scope alone tells consumers which column carries the subject.
 */
const excessiveArm = (
	qx: QueryExecutor,
	scope: V.BanScope,
	targetColumn: PgColumn,
	placeholderName: string,
	keySelection: {
		ipAddress?: ReturnType<typeof sql<string | null>>
		failedCredential?: ReturnType<typeof sql<string | null>>
		userId?: ReturnType<typeof sql<string | null>>
		anonId?: ReturnType<typeof sql<string | null>>
		usersArchiveId?: ReturnType<typeof sql<bigint | null>>
		anonsArchiveId?: ReturnType<typeof sql<bigint | null>>
	},
) =>
	qx
		.select({
			id: sql<string | null>`null`.as('id'),
			ipAddress: (keySelection.ipAddress ?? sql<string | null>`null`).as('ip_address'),
			failedCredential: (keySelection.failedCredential ?? sql<string | null>`null`).as(
				'failed_credential',
			),
			userId: (keySelection.userId ?? sql<string | null>`null`).as('user_id'),
			anonId: (keySelection.anonId ?? sql<string | null>`null`).as('anon_id'),
			usersArchiveId: (keySelection.usersArchiveId ?? sql<bigint | null>`null`).as(
				'users_archive_id',
			),
			anonsArchiveId: (keySelection.anonsArchiveId ?? sql<bigint | null>`null`).as(
				'anons_archive_id',
			),
			scope: sql<V.BanScope>`${scope}::ban_scopes`.as('scope'),
			totalWeight: sql<bigint>`sum(${activityWeight})`.as('total_weight'),
			source: sql<Source>`'excessive_activities'`.as('source'),
		})
		.from(activities)
		.where(
			and(
				withinWindow,
				isNotNull(targetColumn),
				eq(targetColumn, sql.placeholder(placeholderName)),
			),
		)
		.groupBy(targetColumn)
		.having(
			// drizzle mis-generates SQL when the threshold is bound as a real BigInt, so interpolate the number directly
			sql`sum(${activityWeight}) >= ${EXCESSIVE_ACTIVITIES_THRESHOLD}`,
		)

/**
 * One active-ban arm: reads this target's unexpired ban row directly. Mirrors
 * the excessive arms so each scope is a single-index-shaped lookup, with no OR
 * across six columns and no view handoff
 */
const bansArm = (qx: QueryExecutor, targetColumn: PgColumn, placeholderName: string) =>
	qx
		.select({
			id: sql<string | null>`${banId}`.as('id'),
			ipAddress: sql<string | null>`host(${banIpAddress})`.as('ip_address'),
			failedCredential: sql<string | null>`${banFailedCredential}`.as('failed_credential'),
			userId: sql<string | null>`${banUserId}`.as('user_id'),
			anonId: sql<string | null>`${banAnonId}`.as('anon_id'),
			usersArchiveId: sql<bigint | null>`${banUsersArchiveId}`.as('users_archive_id'),
			anonsArchiveId: sql<bigint | null>`${banAnonsArchiveId}`.as('anons_archive_id'),
			scope: sql<V.BanScope>`${banScope}`.as('scope'),
			totalWeight: sql<bigint>`${banTotalWeight}`.as('total_weight'),
			source: sql<Source>`'active_bans'`.as('source'),
		})
		.from(bans)
		.where(
			and(
				gte(banExpiresAt, sql`now()`),
				isNotNull(targetColumn),
				eq(targetColumn, sql.placeholder(placeholderName)),
			),
		)

/**
 * The ban pre-check behind every logged activity and credential sign-in flow:
 * returns the subject's current bans and any scope whose windowed activity
 * weight has crossed the threshold.
 *
 * One UNION arm per (source, scope). Never an OR across targets and never a
 * whole-window aggregate; the arm helpers below own the per-arm shape.
 *
 * Output shape is stable across sources:
 * `{source, scope, targets..., totalWeight}`; activity id arrays are NOT
 * returned. Nobody consumes them here, and new bans fetch their ids via
 * {@link selectActivityIdsByTarget} on the rare threshold-crossing path.
 */
export const selectCurrentAndExcessiveByTargets = createPreparedQuery({
	vSchema: V.ByManyTargets,
	stmtFn: (qx) =>
		bansArm(qx, banIpAddress, 'ipAddress')
			.unionAll(bansArm(qx, banUserId, 'userId'))
			.unionAll(bansArm(qx, banAnonId, 'anonId'))
			.unionAll(bansArm(qx, banFailedCredential, 'failedCredential'))
			.unionAll(bansArm(qx, banUsersArchiveId, 'usersArchiveId'))
			.unionAll(bansArm(qx, banAnonsArchiveId, 'anonsArchiveId'))
			.unionAll(
				excessiveArm(qx, 'IP_ADDRESS', activityIpAddress, 'ipAddress', {
					ipAddress: sql<string | null>`host(${activityIpAddress})`,
				}),
			)
			.unionAll(
				excessiveArm(qx, 'USER', activityUserId, 'userId', {
					userId: sql<string | null>`${activityUserId}`,
				}),
			)
			.unionAll(
				excessiveArm(qx, 'ANON', activityAnonId, 'anonId', {
					anonId: sql<string | null>`${activityAnonId}`,
				}),
			)
			.unionAll(
				excessiveArm(qx, 'FAILED_CREDENTIAL', activityFailedCredential, 'failedCredential', {
					failedCredential: sql<string | null>`${activityFailedCredential}`,
				}),
			)
			.unionAll(
				excessiveArm(qx, 'ARCHIVED_USER', activityUsersArchiveId, 'usersArchiveId', {
					usersArchiveId: sql<bigint | null>`${activityUsersArchiveId}`,
				}),
			)
			.unionAll(
				excessiveArm(qx, 'ARCHIVED_ANON', activityAnonsArchiveId, 'anonsArchiveId', {
					anonsArchiveId: sql<bigint | null>`${activityAnonsArchiveId}`,
				}),
			)
			.prepare('current_bans_and_excessive_activities_select_by_target'),
})

/**
 * Fetches one subject's activity ids within the sliding window. Only used when
 * creating a new ban (rare): the ids become the ban row's audit references.
 *
 * Built dynamically instead of prepared: the caller has already narrowed to a
 * single scope ({@link V.ByOneTarget} enforces exactly one non-null target),
 * so the WHERE carries only that one condition, with no six-way OR and no unused
 * placeholders. Non-prepared is fine for a rare-path query
 */
export const selectActivityIdsByTarget = createQueryFn({
	vSchema: V.BySingleTarget,
	query: (qx, targets) => {
		const targetColumns = {
			ipAddress: activityIpAddress,
			failedCredential: activityFailedCredential,
			userId: activityUserId,
			anonId: activityAnonId,
			usersArchiveId: activityUsersArchiveId,
			anonsArchiveId: activityAnonsArchiveId,
		} satisfies Record<string, PgColumn>

		/**
		 * Runtime null check (not a type-level one): callers pass nulls for every
		 * non-chosen scope regardless of what the decoded types claim
		 */
		const conditions = Object.entries(targets)
			.filter((entry): entry is [keyof typeof targetColumns, string | bigint] => entry[1] != null)
			.map(([name, value]) => {
				const column = targetColumns[name]
				return and(isNotNull(column), eq(column, value))
			})

		return qx
			.select({
				activityIds: sql<string[]>`coalesce(array_agg(${activityId}), '{}')`.as('activity_ids'),
			})
			.from(activities)
			.where(and(withinWindow, ...conditions))
	},
})

/**
 * Zips the two index-aligned input arrays back into (activityId, archiveId)
 * rows. Keeping the arrays as whole-statement parameters is what makes the SQL text
 * constant so it can be prepared once.
 */
const selectPairedIdsCTE = (qx: QueryExecutor) =>
	qx.$with('select_paired_ids_cte').as(
		qx
			.select({
				activityId: sql<string>`p.activity_id`.as('activity_id'),
				archiveId: sql<bigint>`p.archive_id`.as('archive_id'),
			})
			.from(
				/**
				 * unnest zips multiple arrays positionally; a set-returning function is a valid
				 * FROM item, so no nested select is needed. No drizzle builder exists for SRFs.
				 */
				sql`unnest(${sql.placeholder('activityIds')}::uuid[], ${sql.placeholder('archiveIds')}::bigint[]) AS p(activity_id, archive_id)`,
			),
	)

/**
 * One row per affected ban holding the ids to remove and their archive
 * ids. The aggregation is required because Postgres applies an UPDATE ... FROM once
 * per target row even when several join rows match. A ban referencing multiple
 * archived activities must fold all of them into a single update or lose all but one.
 *
 * The join fans out per pair row (not per array element), so addedIds holds each
 * archive id at most once even if a ban's activityIds contained an id twice. Such
 * duplicates only affect removal, where every occurrence drops out.
 */
const selectMatchedBansCTE = (qx: QueryExecutor) => {
	const pairs = selectPairedIdsCTE(qx)
	return qx.$with('select_matched_bans_cte').as(
		qx
			.select({
				banId: bans.id,
				removedIds: sql<string[]>`array_agg(${pairs.activityId})`.as('removed_ids'),
				addedIds: sql<bigint[]>`array_agg(${pairs.archiveId})`.as('added_ids'),
			})
			.from(bans)
			.innerJoin(pairs, sql`${bans.activityIds} @> ARRAY[${pairs.activityId}]`)
			.groupBy(bans.id),
	)
}

/**
 * Re-points every ban that references any of the given archived activities in one
 * set-based statement: removes the archived ids from activityIds and appends the
 * matching archive ids to activitiesArchiveIds.
 *
 * Used by the activities archive cascade (see archiveManyOldByCutoff), where it replaces
 * one UPDATE-per-archived-row with a single statement whose cost scales with the number
 * of affected bans instead of the number of archived rows.
 *
 * Composes {@link selectPairedIdsCTE} and {@link selectMatchedBansCTE}, then
 * applies each matched ban's removals and additions in one update.
 */
export const updateBansForArchivedActivities = createPreparedQuery({
	vSchema: V.UpdateBansForArchivedActivities,
	stmtFn: (qx) => {
		const pairs = selectPairedIdsCTE(qx)
		const matched = selectMatchedBansCTE(qx)

		return qx
			.with(pairs, matched)
			.update(bans)
			.set({
				/** Array difference: keep this ban's activity ids that were not archived */
				activityIds: sql`COALESCE((
						SELECT array_agg(a.id ORDER BY a.ord)
						FROM unnest(${bans.activityIds}) WITH ORDINALITY AS a(id, ord)
						WHERE NOT (a.id = ANY(${matched.removedIds}))
					), '{}')`,
				activitiesArchiveIds: sql`${bans.activitiesArchiveIds} || ${matched.addedIds}`,
			})
			.from(matched)
			.where(eq(bans.id, matched.banId))
			.prepare('bans_update_for_archived_activities')
	},
})

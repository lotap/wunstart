import {getColumns, sql} from 'drizzle-orm'

import {createPreparedQuery, createQueryFn} from '#/db/helpers/funcs.ts'
import {EXCESSIVE_ACTIVITIES_THRESHOLD} from '#/db/models/activities/consts.ts'

import {PENALTY_INTERVAL_INITIAL_QTY, PENALTY_INTERVAL_MAX_QTY} from './consts.ts'
import {activeTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {id} = getColumns(activeTable)

/// INSERT ///

export const insert = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				scope: sql.placeholder('scope'),
				ipAddress: sql.placeholder('ipAddress'),
				userId: sql.placeholder('userId'),
				anonId: sql.placeholder('anonId'),
				failedCredential: sql.placeholder('failedCredential'),
				usersArchiveId: sql.placeholder('usersArchiveId'),
				anonsArchiveId: sql.placeholder('anonsArchiveId'),
				activityIds: sql.placeholder('activityIds'),
				activitiesArchiveIds: sql.placeholder('activitiesArchiveIds'),
				expiresAt: sql`now() + ${sql.placeholder('penaltyInterval')}::interval`,
			})
			.returning({id})
			.prepare(`${labelPrefix}_insert`),
})

/**
 * Inserts new bans; if a concurrent transaction already created a ban for the
 * same (scope, target), merges into it instead of failing.
 *
 * Two racing transactions can both observe "no ban for this scope" and
 * both attempt an insert. The `bans_scope_target_unique`
 * constraint arbitrates the race at the row level with no locks
 * on the happy path, and this DO UPDATE folds the loser's data into
 * the winner's row so it commits either way:
 *
 * - activity id arrays are unioned as sets: duplicates dropped, order not
 *   meaningful (consumers match via ANY()/@>, never by position)
 * - expiry keeps the larger penalty via GREATEST, convergent under concurrency
 *   exactly like {@link extendMany}
 * - total_weight accumulates additively; see the note at the set below
 */
export const insertOrMergeMany = createQueryFn({
	vSchema: V.InsertMany,
	query: (qx, inputs) => {
		const {scope, ipAddress, failedCredential, userId, anonId, usersArchiveId, anonsArchiveId} =
			getColumns(activeTable)

		return qx
			.insert(activeTable)
			.values(
				inputs.map((input) => {
					const {penaltyInterval, ...rest} = input
					return {
						...rest,
						expiresAt: sql`now() + ${penaltyInterval}::interval`,
					}
				}),
			)
			.onConflictDoUpdate({
				target: [
					scope,
					ipAddress,
					failedCredential,
					userId,
					anonId,
					usersArchiveId,
					anonsArchiveId,
				],
				set: {
					/**
					 * Merged as sets: unnest + DISTINCT drops any id the winner's row
					 * already carries (the arrays are consumed as unordered sets via
					 * ANY()/@> joins). COALESCE guards the empty-input case, where
					 * array_agg over zero rows would return NULL against a NOT NULL
					 * column
					 */
					activityIds: sql`COALESCE((
							SELECT array_agg(DISTINCT x)
							FROM unnest(${activeTable.activityIds} || excluded.activity_ids) AS x
						), '{}')`,
					activitiesArchiveIds: sql`COALESCE((
							SELECT array_agg(DISTINCT x)
							FROM unnest(${activeTable.activitiesArchiveIds} || excluded.activities_archive_ids) AS x
						), '{}')`,
					expiresAt: sql`GREATEST(${activeTable.expiresAt}, excluded.expires_at)`,
					/**
					 * Additive merge. Both racers computed their totals from overlapping
					 * windows, so the sum can double-count shared rows post-race. That
					 * only ever over-states weight, the safe direction for a security
					 * control.
					 */
					totalWeight: sql`${activeTable.totalWeight} + excluded.total_weight`,
				},
			})
			.returning({id})
	},
})

/// SELECT ///

/// UPDATE ///

/**
 * Extends every listed ban in ONE statement: appends the new activity's id and
 * adds its weight to the ban's total_weight accumulator, then pushes expiry
 * out by a penalty derived from each ban's own pre-update total.
 *
 * The per-ban interval is computed inside SQL from `total_weight`. An
 * UPDATE's SET clause sees pre-update values, which matches
 * calculatePenaltyTime semantics (extension math uses the accumulated weight
 * excluding the incoming activity). This is a deliberate SQL port of that
 * function; change them together. GREATEST keeps extensions convergent under
 * concurrency: racing transactions can never shorten a ban, the larger
 * penalty wins regardless of commit order.
 */
export const extendMany = createPreparedQuery({
	vSchema: V.ExtendMany,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({
				activityIds: sql`${activeTable.activityIds} || ${sql.placeholder('activityId')}::uuid`,
				totalWeight: sql`${activeTable.totalWeight} + ${sql.placeholder('weightDelta')}::bigint`,
				expiresAt: sql`GREATEST(
					${activeTable.expiresAt},
					now() + make_interval(mins => LEAST(
						ceil(${PENALTY_INTERVAL_INITIAL_QTY}::double precision * power(
							2::double precision,
							LEAST(
								${activeTable.totalWeight}::double precision / ${EXCESSIVE_ACTIVITIES_THRESHOLD}::double precision - 1,
								5::double precision
							)
						))::int,
						${PENALTY_INTERVAL_MAX_QTY}
					))
				)`,
			})
			.where(
				sql`${activeTable.id} = ANY(${sql.placeholder('ids')}::uuid[]) AND ${activeTable.expiresAt} >= now()`,
			)
			.returning({id})
			.prepare(`${labelPrefix}_extend_many`),
})

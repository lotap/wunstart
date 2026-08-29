import {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {Cause, Effect, Exit, Option, Ref, Schema} from 'effect'

import {DB} from '#/db/index.ts'
import * as activitiesBansQueries from '#/db/models/activities---bans/queries.ts'
import {type BanScope, ByManyTargets} from '#/db/models/activities---bans/validations.ts'
import {ACTIVITIES_BASELINE_WEIGHT} from '#/db/models/activities/consts.ts'
import * as activitiesQueries from '#/db/models/activities/queries.ts'
import type {Insert as ActivitiesInsert} from '#/db/models/activities/validations.ts'
import * as anonsQueries from '#/db/models/anons/queries.ts'
import * as bansQueries from '#/db/models/bans/queries.ts'
import type {InsertMany as BansInsertMany} from '#/db/models/bans/validations.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {
	CurrentBansAndExcessiveActivities,
	type CurrentBansAndExcessiveActivitiesCtx,
	type CurrentBansAndExcessiveActivitiesRows,
} from '#/db/ops/_current-bans-and-excessive-activities.ts'

import {extractPgError, extractPgErrorMessage} from './_extract-pg-error.ts'
import {retryTransientDb} from './_retry.ts'
import {calculatePenaltyTime} from './auth/_calc-penalty-time.ts'
import {extractErrorProps, isOpsError} from './ops-error.ts'

/**
 * The activities anonId/userId columns are FKs to the active anons/users tables,
 * but a token or session can outlive its row (retirement archives it). Resolution
 * runs only after a constraint failure proves a target may have moved: a live
 * entity keeps its id; a retired one is re-pointed to its archive id so the
 * ARCHIVED_* ban scopes still apply; an unknown id populates neither column.
 */
const resolveActivityEntities = Effect.fn('resolveActivityEntities')(
	(input: (typeof ActivitiesInsert)['Encoded']) =>
		Effect.gen(function* () {
			const {anonId, anonsArchiveId, userId, usersArchiveId} = input

			const data = {anonId, anonsArchiveId, userId, usersArchiveId}

			if (anonId && !anonsArchiveId) {
				const [active] = yield* anonsQueries.select({id: anonId})
				if (active) {
					data.anonsArchiveId = null
				} else {
					const [archived] = yield* anonsQueries.archiveSelectByActiveId({id: anonId})
					data.anonId = null
					data.anonsArchiveId = archived?.archiveId ?? null
				}
			}

			if (userId && !usersArchiveId) {
				const [active] = yield* usersQueries.select({id: userId})
				if (active) {
					data.usersArchiveId = null
				} else {
					const [archived] = yield* usersQueries.archiveSelectByActiveId({id: userId})
					data.userId = null
					data.usersArchiveId = archived?.archiveId ?? null
				}
			}

			return data
		}),
)

type CurrentBansAndExcessiveActivitiesRow = CurrentBansAndExcessiveActivitiesRows[number]

/**
 * Strips the query's bookkeeping columns (id, source), turns the group's
 * totalWeight into the ban's initial penalty interval and starting weight
 * accumulator, yielding a bans insert payload minus its activity ids (fetched
 * separately via selectActivityIdsByTarget).
 *
 * `extraWeight` compensates for snapshot age: a row taken from a pre-op
 * snapshot predates the activity being logged, while a fresh in-transaction
 * aggregate already counts it. See logActivityAndHandleBans
 */
const toBanInsert = (
	{
		scope,
		ipAddress,
		failedCredential,
		userId,
		anonId,
		usersArchiveId,
		anonsArchiveId,
		totalWeight,
	}: CurrentBansAndExcessiveActivitiesRow,
	extraWeight = BigInt(0),
) => {
	/**
	 * node-pg delivers int8 columns as strings despite the query's bigint
	 * annotation, so neither the null guard nor the BigInt conversion is
	 * redundant at runtime, whatever the types claim
	 */
	// oxlint-disable-next-line
	const seededTotal = BigInt(totalWeight ?? 0) + extraWeight

	return {
		scope,
		ipAddress,
		failedCredential,
		userId,
		anonId,
		usersArchiveId,
		anonsArchiveId,
		penaltyInterval: calculatePenaltyTime(seededTotal),
		totalWeight: seededTotal,
	}
}

/**
 * Narrows a pre-check row to its single scope-owned target so
 * selectActivityIdsByTarget aggregates exactly that subject's window.
 * ByTargets requires at least one non-null field, and the scope's own column is
 * guaranteed populated for excessive rows by the underlying grouping
 */
const toTargetInput = ({
	scope,
	ipAddress,
	failedCredential,
	userId,
	anonId,
	usersArchiveId,
	anonsArchiveId,
}: CurrentBansAndExcessiveActivitiesRow): (typeof ByManyTargets)['Encoded'] => ({
	/**
	 * The validation's Encoded form is optional-field/undefined (nulls are its
	 * decoded default), so non-chosen scopes are omitted rather than nulled
	 */
	ipAddress: scope === 'IP_ADDRESS' ? (ipAddress ?? undefined) : undefined,
	failedCredential: scope === 'FAILED_CREDENTIAL' ? (failedCredential ?? undefined) : undefined,
	userId: scope === 'USER' ? (userId ?? undefined) : undefined,
	anonId: scope === 'ANON' ? (anonId ?? undefined) : undefined,
	usersArchiveId: scope === 'ARCHIVED_USER' ? (usersArchiveId ?? undefined) : undefined,
	anonsArchiveId: scope === 'ARCHIVED_ANON' ? (anonsArchiveId ?? undefined) : undefined,
})

/**
 * Records an activity and applies its security consequences in one
 * transaction: inserts the activity row, extends bans the activity's own
 * scope implicates, and creates a new ban when a scope's windowed weight
 * crosses the threshold. The whole group commits atomically, so a partial
 * set of security records can never exist.
 *
 * Reuses rows stashed by `checkCurrentBansAndExcessiveActivities` when they
 * are available
 *
 * @todo postgres triggers are a better solution for creating/updating bans from an activity entry,
 * but they are not directly supported by drizzle and would require manually modifying the migration files.
 * That may be considered in a future version.
 */
const logActivityAndHandleBans = Effect.fn('logActivityAndHandleBans')(
	(input: (typeof ActivitiesInsert)['Encoded']) =>
		Effect.gen(function* () {
			const db = yield* DB

			// Rows stashed by checkCurrentBansAndExcessiveActivities, or null when the
			// caller ran no pre-check and the union below must run fresh.
			const prefetchedCurrentBansAndExcessiveActivities: CurrentBansAndExcessiveActivitiesCtx =
				yield* Effect.serviceOption(CurrentBansAndExcessiveActivities).pipe(
					Effect.flatMap(
						Option.match({
							onNone: () => Effect.succeed<CurrentBansAndExcessiveActivitiesCtx>(null),
							onSome: (prefetchedRowsRef) => Ref.getAndSet(prefetchedRowsRef, null),
						}),
					),
				)

			const attempt = (resolvedInput: (typeof ActivitiesInsert)['Encoded']) =>
				db.transaction((tx) =>
					Effect.gen(function* () {
						const [rowData] = yield* activitiesQueries.insert(resolvedInput, tx)

						// should be unreachable, drizzle throws on failed insert but it makes the linter happy
						if (!rowData) return yield* Effect.die(new Error('Problem inserting activity'))

						const {id: activityId, weight} = rowData
						const weightDelta = BigInt(weight)

						const {ipAddress, failedCredential, userId, anonId, anonsArchiveId, usersArchiveId} =
							resolvedInput

						const currentBansAndExcessiveActivities =
							prefetchedCurrentBansAndExcessiveActivities ??
							(yield* activitiesBansQueries.selectCurrentAndExcessiveByTargets(
								{ipAddress, failedCredential, userId, anonId, anonsArchiveId, usersArchiveId},
								tx,
							))

						const extendableBanIds: string[] = []
						const existingBansScopes: (typeof currentBansAndExcessiveActivities)[number]['scope'][] =
							[]

						/**
						 * An activity may only extend bans of its own scope. The lookup
						 * above intentionally matches more bans than that. Sign-ins inspect
						 * credential scope even though denials never carry failedCredential,
						 * so each match gets this check.
						 *
						 * This prevents denied requests from compounding an
						 * unrelated ban's penalty indefinitely
						 */
						const implicatesScope = {
							IP_ADDRESS: Boolean(ipAddress),
							USER: Boolean(userId),
							ANON: Boolean(anonId),
							FAILED_CREDENTIAL: Boolean(failedCredential),
							ARCHIVED_USER: Boolean(usersArchiveId),
							ARCHIVED_ANON: Boolean(anonsArchiveId),
						} satisfies Record<BanScope, boolean>

						for (const {id, scope, source} of currentBansAndExcessiveActivities) {
							// active_bans should always have an id, the extra check prevents typescript errors
							if (source === 'active_bans' && id !== null) {
								existingBansScopes.push(scope)
								if (!implicatesScope[scope]) continue

								extendableBanIds.push(id)
							}
						}

						/**
						 * One bundled statement extends every implicated ban.
						 *
						 * With prefetched rows this works from a pre-op snapshot: a ban
						 * created after it was taken is missed this attempt and extended
						 * by the next logged activity, and a ban that expired in between
						 * is never resurrected because extendMany filters expired ids.
						 * Racing extensions converge either way, since extendMany keeps
						 * the larger penalty via GREATEST.
						 */
						const extendBansEffect = extendableBanIds.length
							? bansQueries.extendMany({ids: extendableBanIds, activityId, weightDelta}, tx)
							: undefined

						const newBans = currentBansAndExcessiveActivities.filter(
							({source, scope}) =>
								source === 'excessive_activities' && !existingBansScopes.includes(scope),
						)

						/**
						 * New bans need their window's activity ids as audit references; the
						 * pre-check no longer ships id arrays (they can grow unbounded under
						 * repeated denials), so they are fetched here, once per new ban, on
						 * the rare threshold-crossing path only. The aggregate necessarily
						 * includes the activity just inserted: it matches the same window and
						 * target inside this transaction's snapshot
						 *
						 * A threshold crossing caused by this activity alone surfaces one
						 * attempt later than with a fresh check: the next request's
						 * pre-check sees it and rejects there
						 */
						const bansInsertEffect = newBans.length
							? Effect.forEach(newBans, (ban) =>
									Effect.gen(function* () {
										const [ids] = yield* activitiesBansQueries.selectActivityIdsByTarget(
											toTargetInput(ban),
											tx,
										)
										/**
										 * Pre-op snapshots exclude the just-inserted activity; fresh
										 * in-transaction aggregates include it. Adding the delta to
										 * stale rows keeps the seeded total identical either way
										 */
										return {
											...toBanInsert(
												ban,
												prefetchedCurrentBansAndExcessiveActivities ? weightDelta : BigInt(0),
											),
											activityIds: ids?.activityIds ?? [],
										}
									}),
								).pipe(
									Effect.flatMap((payloads) =>
										bansQueries.insertOrMergeMany(
											/**
											 * SAFETY: the row's scope is a plain enum, not a discriminant, so TS
											 * cannot see which Insert variant each payload matches; the schema
											 * decodes it at runtime (same VSchema-narrowing limitation as funcs.ts)
											 */
											payloads as (typeof BansInsertMany)['Encoded'],
											tx,
										),
									),
								)
							: undefined

						yield* Effect.all(
							[extendBansEffect, bansInsertEffect].filter((effect) => effect !== undefined),
						)

						return rowData
					}),
				)

			/**
			 * A concurrent retirement can archive the anon or user between op execution
			 * and the insert, violating the FK. Only a constraint failure on an input that
			 * carries entity ids is resolvable: re-check the target rows, and if one
			 * actually moved, re-run the transaction once against the resolved ids.
			 * Everything else propagates unchanged.
			 */
			return yield* attempt(input).pipe(
				Effect.catch((error) =>
					Effect.gen(function* () {
						if (
							(input.anonId == null && input.userId == null) ||
							!Schema.is(EffectDrizzleQueryError)(error) ||
							extractPgError(error) !== 'ConstraintError'
						)
							return yield* error

						const resolved = yield* resolveActivityEntities(input)

						/** Targets unchanged, so the constraint failure was not an entity-target race. Propagate */
						const moved =
							(resolved.anonId ?? null) !== (input.anonId ?? null) ||
							(resolved.anonsArchiveId ?? null) !== (input.anonsArchiveId ?? null) ||
							(resolved.userId ?? null) !== (input.userId ?? null) ||
							(resolved.usersArchiveId ?? null) !== (input.usersArchiveId ?? null)

						return moved ? yield* attempt({...input, ...resolved}) : yield* error
					}),
				),
				retryTransientDb,
				Effect.onExitIf(Exit.isFailure, (exit) =>
					Exit.match(exit, {
						onSuccess: () => Effect.void,
						/** Pure interruptions are not a lost record, so no telemetry */
						onFailure: (cause) =>
							Cause.hasInterruptsOnly(cause)
								? Effect.void
								: Effect.logError('Activity logging failed', {
										label: input.label,
										failure: extractErrorProps(cause),
									}),
					}),
				),
			)
		}),
)

type ActivityInsertInput = (typeof ActivitiesInsert)['Encoded']

/**
 * Logs a given error as a failed activity.
 * Automatically formats unknown errors for safe database entry.
 *
 * If the activity row cannot be written, this effect fails; the ops wrapper
 * swallows that failure (the structured error log is already emitted here) so
 * the op's own failure is never masked by its activity record.
 */
export const logFailedActivity = Effect.fn('logFailedActivity')(function* ({
	error,
	weight,
	...passThrough
}: {
	error: unknown
	label: ActivityInsertInput['label']
	ipAddress: ActivityInsertInput['ipAddress']
	/**
	 * Overrides the baseline weight for the UNKNOWN branch. The wrapper's defect
	 * path always lands here, passing a full Cause and 0. Server-side
	 * defects are not user behavior and must not feed ban thresholds. An
	 * ops error always keeps its own weight.
	 */
	weight?: number
}) {
	if (isOpsError(error)) {
		yield* Effect.logDebug('Ops Error', error)

		return yield* logActivityAndHandleBans({
			...error.activity,
			...passThrough,
			success: false,
		})
	}

	if (Schema.is(EffectDrizzleQueryError)(error)) {
		/**
		 * Parameters can embed hashes and credentials, so never persist them.
		 * Drizzle's own `message` getter embeds the params too, so it is excluded;
		 * the underlying Postgres message never contains parameter values. The
		 * query text is static SQL with placeholders only.
		 */
		const {name, query} = error
		const message = extractPgErrorMessage(error)

		yield* Effect.logError('Database query failed', {
			name,
			query,
			message,
		})

		return yield* logActivityAndHandleBans({
			...passThrough,
			success: false,
			failureCause: 'DRIZZLE_QUERY_ERROR',
			meta: {
				name,
				query,
				message,
			},
			weight: ACTIVITIES_BASELINE_WEIGHT,
		})
	}

	yield* Effect.logDebug('Unknown Error', error)

	const errorProps = extractErrorProps(error)

	return yield* logActivityAndHandleBans({
		...passThrough,
		success: false,
		failureCause: 'UNKNOWN',
		meta: errorProps,
		weight: weight ?? ACTIVITIES_BASELINE_WEIGHT,
	})
})

/**
 * Logs a given activity as a success.
 *
 * If the activity row cannot be written, this effect fails; the ops wrapper
 * swallows that failure (the structured error log is already emitted here) so
 * a committed mutation is never misreported as failed.
 */
export const logSuccessfulActivity = Effect.fn('logSuccessfulActivity')(function* (
	input: Omit<Extract<ActivityInsertInput, {success: true}>, 'success'>,
) {
	return yield* logActivityAndHandleBans({
		...input,
		success: true,
	})
})

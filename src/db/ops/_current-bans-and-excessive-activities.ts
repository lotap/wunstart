import {Context, Effect, Option, Ref} from 'effect'

import * as activitiesBansQueries from '#/db/models/activities---bans/queries.ts'
import {ByManyTargets} from '#/db/models/activities---bans/validations.ts'

export type CurrentBansAndExcessiveActivitiesRows = Effect.Success<
	ReturnType<typeof activitiesBansQueries.selectCurrentAndExcessiveByTargets>
>

export type CurrentBansAndExcessiveActivitiesCtx = CurrentBansAndExcessiveActivitiesRows | null

type PrefetchedRowsRef = Ref.Ref<CurrentBansAndExcessiveActivitiesCtx>

/**
 * Request-scoped carrier for a ban pre-check result.
 *
 * Several credential ops must run selectCurrentAndExcessiveByTargets BEFORE
 * deciding whether to proceed (the reject/allow decision precedes any work).
 * The activity logging that follows would otherwise run the identical 12-arm
 * union again inside its transaction, paying half the ban work per auth
 * attempt twice. {@link checkCurrentBansAndExcessiveActivities} stashes the
 * rows in the service's `prefetchedRowsRef`; `logActivityAndHandleBans` pulls
 * and clears them when it runs.
 *
 * The prefetchedRowsRef is created fresh per op invocation and provided by createOpsFn,
 * so values never leak across requests or fibers. Rows are a snapshot taken
 * before the op's own activity exists: see logActivityAndHandleBans for how
 * that staleness is bounded and compensated.
 *
 * This is intentionally a Ref-carrying service rather than a behavior
 * interface or a `Context.Reference`: the rows are one-shot, invocation-local
 * state handed from an op body to its own logging, not a lookupable value
 * (a Reference's default would be shared across concurrent requests) and not
 * part of the public API.
 */
export class CurrentBansAndExcessiveActivities extends Context.Service<
	CurrentBansAndExcessiveActivities,
	PrefetchedRowsRef
>()('ops.CurrentBansAndExcessiveActivities') {}

/**
 * Runs the ban pre-check for the given targets and stashes its rows so this
 * invocation's activity logging reuses them instead of re-running the union.
 */
export const checkCurrentBansAndExcessiveActivities = Effect.fn(
	'checkCurrentBansAndExcessiveActivities',
)(function* (targets: (typeof ByManyTargets)['Encoded']) {
	const rows = yield* activitiesBansQueries.selectCurrentAndExcessiveByTargets(targets)
	const prefetchedRowsRef = yield* Effect.serviceOption(CurrentBansAndExcessiveActivities)
	if (Option.isSome(prefetchedRowsRef)) yield* Ref.set(prefetchedRowsRef.value, rows)
	return rows
})

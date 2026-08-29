import {Effect, Schedule} from 'effect'

import {isRollbackSafePgError, isTransientPgError} from './_extract-pg-error.ts'

const transientDbRetrySchedule = Schedule.exponential('100 millis', 2).pipe(Schedule.jittered)

const retryOn =
	(whilePredicate: (cause: unknown) => boolean) =>
	<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
		effect.pipe(
			Effect.retry({
				times: 2,
				schedule: transientDbRetrySchedule,
				while: whilePredicate,
			}),
		)

/**
 * Retries a failing effect only when the failure is a transient Postgres condition
 * (connection drops, deadlocks, serialization conflicts).
 *
 * Safe around `db.transaction(...)` calls, because every statement inside rolls back on
 * failure, so a retry re-runs the work in a fresh transaction. For standalone statements prefer
 * {@link retryRollbackSafeDb} unless the statement is read-only or re-execution is
 * otherwise harmless (e.g. guarded by a row-scoped predicate). Do not wrap individual
 * statements inside the transaction, as Postgres aborts the transaction on the first error.
 */
export const retryTransientDb = retryOn(isTransientPgError)

/**
 * Retries a failing effect only on server-issued Postgres errors that guarantee the
 * statement aborted: deadlocks, serialization conflicts, lock/statement timeouts.
 * Never on connection errors, which can fire after a standalone statement already
 * committed (response lost mid-flight) and would double-apply on re-execution.
 *
 * Use for non-idempotent standalone statements (e.g. `SET attempts = attempts + 1`).
 */
export const retryRollbackSafeDb = retryOn(isRollbackSafePgError)

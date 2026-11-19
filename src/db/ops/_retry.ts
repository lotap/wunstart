import {Effect, Schedule, Schema} from 'effect'

import {ArchiveCountMismatchError} from '#/db/helpers/archive-fns.ts'

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
 * Retries on transient Postgres failures or a lost concurrent-archive race.
 *
 * An archive reads its rows, inserts copies, then deletes by id. Two writers
 * can both select the same row; the loser’s delete succeeds but returns zero
 * rows, and the application-level count check raises
 * `ArchiveCountMismatchError`. The transaction is still healthy at that point,
 * but catching the error here would commit the loser’s archive insert as a
 * duplicate. Let it roll the transaction back and retry; the next attempt sees
 * no active row and can return the winner’s archive row.
 *
 * Used by the sign-in/sign-up transactions that retire a registered Anon.
 */
export const retryTransientOrArchiveRace = retryOn(
	(error) => isTransientPgError(error) || Schema.is(ArchiveCountMismatchError)(error),
)

/**
 * Retries a failing effect only on server-issued Postgres errors that guarantee the
 * statement aborted: deadlocks, serialization conflicts, lock/statement timeouts.
 * Never on connection errors, which can fire after a standalone statement already
 * committed (response lost mid-flight) and would double-apply on re-execution.
 *
 * Use for non-idempotent standalone statements (e.g. `SET attempts = attempts + 1`).
 */
export const retryRollbackSafeDb = retryOn(isRollbackSafePgError)

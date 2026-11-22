/**
 * `unstableApiUsage` warns that the driver's `SqlError` model may change in any
 * release. Postgres failure classification needs its typed reasons (deadlocks,
 * serialization conflicts, timeouts) to decide retries and rollback safety, and
 * the stable Effect surface exposes no equivalent. Each usage below is suppressed
 * because this module is the only adapter to that model: an upstream shape change
 * breaks the typecheck here, and only here.
 */
import {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {Cause, Option, Schema} from 'effect'
import {
	DeadlockError,
	LockTimeoutError,
	SerializationError,
	SqlError,
	type SqlErrorReason,
	StatementTimeoutError,
} from 'effect/sql/SqlError'

/**
 * Finds the underlying SqlError in a drizzle error's cause, if any.
 *
 * `cause` is declared as `Schema.Unknown` by drizzle's error schema, but structurally it is a
 * `Cause<SqlError>`, because drizzle wraps sql() failures with EffectDrizzleQueryError in
 * drizzle-orm/effect-core/errors.ts. The cast is required to reach into it.
 */
const findSqlError = (drizzleError: EffectDrizzleQueryError) => {
	// SAFETY: drizzle declares `cause` as Schema.Unknown, but structurally it is a
	// `Cause<SqlError>` (drizzle-orm/effect-core wraps sql() failures in
	// EffectDrizzleQueryError); Schema.is below validates the unwrapped error.
	const sqlErrorOpt = Cause.findErrorOption(drizzleError.cause as Cause.Cause<unknown>)

	if (Option.isSome(sqlErrorOpt)) {
		const sqlError = sqlErrorOpt.value

		// @effect-diagnostics-next-line unstableApiUsage:off
		if (Schema.is(SqlError)(sqlError)) return sqlError
	}

	return undefined
}

/**
 * The driver's top-level message for a drizzle query failure, if any.
 *
 * `SqlError.message` resolves to its reason's message: a driver-generated
 * summary such as `PgConnection: Query failed`, another connection-level
 * literal, or the reason tag when the reason carries no message. The server's
 * own text lives on the reason's `cause.message` and is not returned here;
 * that text never contains bound parameter values, but data-exception messages
 * (22xxx) can echo literal input values (e.g. `invalid input syntax for type
 * uuid: "abc"`), so treat any server text as untrusted when persisting it.
 */
export const extractPgErrorMessage = (drizzleError: EffectDrizzleQueryError) =>
	// @effect-diagnostics-next-line unstableApiUsage:off
	findSqlError(drizzleError)?.message

export function extractPgError(drizzleError: EffectDrizzleQueryError) {
	return findSqlError(drizzleError)?.reason._tag
}

/**
 * The Postgres SQLSTATE from a constraint violation, when the driver attached
 * one. `23503` is a foreign-key violation; `23502` (NOT NULL) and `23514`
 * (CHECK) must stay internal, so classify by the code rather than the generic
 * `ConstraintError` tag. The fields live on the reason's `cause`, not on
 * `SqlError.message`, which stays a generic connection message.
 */
const PgCode = Schema.Struct({code: Schema.String})

export const extractPgCode = (drizzleError: EffectDrizzleQueryError) => {
	const reason = findSqlError(drizzleError)?.reason

	if (!reason || !('cause' in reason)) return undefined

	return Schema.is(PgCode)(reason.cause) ? reason.cause.code : undefined
}

// @effect-diagnostics-next-line unstableApiUsage:off
const reasonOf = (cause: unknown): SqlErrorReason | undefined => {
	if (Schema.is(EffectDrizzleQueryError)(cause)) return findSqlError(cause)?.reason

	// @effect-diagnostics-next-line unstableApiUsage:off
	if (Schema.is(SqlError)(cause)) return cause.reason

	return undefined
}

/**
 * True when the failure is a transient Postgres condition worth retrying.
 * Retryability is classified by effect's SqlErrorReason (connection drops, deadlocks, and
 * serialization conflicts are retryable; constraint/auth violations are not).
 */
// @effect-diagnostics-next-line unstableApiUsage:off
export const isTransientPgError = (cause: unknown) => reasonOf(cause)?.isRetryable ?? false

// @effect-diagnostics-next-line unstableApiUsage:off
const isRollbackSafeReason = (reason: SqlErrorReason) =>
	// @effect-diagnostics-next-line unstableApiUsage:off
	Schema.is(DeadlockError)(reason) ||
	// @effect-diagnostics-next-line unstableApiUsage:off
	Schema.is(SerializationError)(reason) ||
	// @effect-diagnostics-next-line unstableApiUsage:off
	Schema.is(LockTimeoutError)(reason) ||
	// @effect-diagnostics-next-line unstableApiUsage:off
	Schema.is(StatementTimeoutError)(reason)

/**
 * True when the failure is a server-issued Postgres error that guarantees the statement
 * (and any enclosing transaction) was aborted: deadlocks, serialization conflicts,
 * lock/statement timeouts. Unlike {@link isTransientPgError} this excludes connection
 * errors: a connection drop can occur after a standalone statement already committed
 * but before the response arrived, so retrying is only safe for statements whose
 * re-execution cannot double-apply.
 */
export const isRollbackSafePgError = (cause: unknown) => {
	const reason = reasonOf(cause)

	return reason !== undefined && isRollbackSafeReason(reason)
}

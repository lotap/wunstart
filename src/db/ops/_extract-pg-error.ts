import {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {Cause, Option, Schema} from 'effect'
import {
	DeadlockError,
	LockTimeoutError,
	SerializationError,
	SqlError,
	type SqlErrorReason,
	StatementTimeoutError,
} from 'effect/unstable/sql/SqlError'

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
		if (Schema.is(SqlError)(sqlError)) return sqlError
	}
	return undefined
}

/**
 * The underlying Postgres server message from a drizzle error, if any.
 *
 * Unlike `EffectDrizzleQueryError.message`, a getter that embeds the bound
 * query parameters, this is the server's own error text, which never contains
 * bound parameter values. Data-exception messages (22xxx) can still echo
 * literal input values (e.g. `invalid input syntax for type uuid: "abc"`), so
 * treat the message as untrusted when persisting it.
 */
export const extractPgErrorMessage = (drizzleError: EffectDrizzleQueryError) =>
	findSqlError(drizzleError)?.message

export function extractPgError(drizzleError: EffectDrizzleQueryError) {
	return findSqlError(drizzleError)?.reason._tag
}

const reasonOf = (cause: unknown): SqlErrorReason | undefined => {
	if (Schema.is(EffectDrizzleQueryError)(cause)) return findSqlError(cause)?.reason
	if (Schema.is(SqlError)(cause)) return cause.reason
	return undefined
}

/**
 * True when the failure is a transient Postgres condition worth retrying.
 * Retryability is classified by effect's SqlErrorReason (connection drops, deadlocks, and
 * serialization conflicts are retryable; constraint/auth violations are not).
 */
export const isTransientPgError = (cause: unknown) => reasonOf(cause)?.isRetryable ?? false

const isRollbackSafeReason = (reason: SqlErrorReason) =>
	Schema.is(DeadlockError)(reason) ||
	Schema.is(SerializationError)(reason) ||
	Schema.is(LockTimeoutError)(reason) ||
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

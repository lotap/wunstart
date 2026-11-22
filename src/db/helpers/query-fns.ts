import {sql, type SQL} from 'drizzle-orm'
import type {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import type {PgColumn} from 'drizzle-orm/pg-core'
import type {PgEffectPreparedQuery} from 'drizzle-orm/pg-core/effect'
import {Effect, Schema} from 'effect'

import type {ArrayOfStructLikes, QueryExecutor, StructLike, Tx} from '#/db/helpers/types.ts'
import {DB} from '#/db/index.ts'

/**
 * Build the SQL for appending `incomingArraySql` to an array column as a
 * bounded, most-recent-last history.
 *
 * Use it when a column accumulates values over time and order matters: plain
 * concatenation grows without bound and keeps duplicates, while `DISTINCT`
 * deduplicates but returns an arbitrary order. This keeps one entry per value,
 * moves a re-visited value to the end, and retains only the `maxLen` newest
 * unique values, so the last element is the most recent one callers can rely
 * on. Doing it inside the `UPDATE` also avoids a read-modify-write race between
 * concurrent writers.
 *
 * The cap is by count, not age, and trims on the next write.
 */
export function appendUniqueBoundedSql(col: PgColumn, incomingArraySql: SQL, maxLen = 32) {
	return sql`ARRAY(
		SELECT val FROM (
			SELECT val, max(ord) AS last_ord
			FROM unnest(${col} || ${incomingArraySql}) WITH ORDINALITY AS t(val, ord)
			GROUP BY val
			ORDER BY last_ord DESC
			LIMIT ${maxLen}
		) sub
		ORDER BY last_ord ASC
	)`
}

/**
 * Convenience function to reduce boilerplate for writing functions that query the database.
 *
 * The function returned automatically handles typing for the input based on the validation schema and using a transaction if one is provided.
 */
export function createQueryFn<VSchema extends StructLike | ArrayOfStructLikes, TResult, TError>({
	vSchema,
	query,
}: {
	vSchema: VSchema
	query: (qx: QueryExecutor, input: VSchema['Type']) => Effect.Effect<TResult, TError, DB>
}) {
	return Effect.fn(function* (input: VSchema['Encoded'], tx?: Tx) {
		const parsed = yield* Schema.decodeUnknownEffect(vSchema)(input)

		if (tx) return yield* query(tx, parsed)

		const db = yield* DB

		return yield* query(db, parsed)
	})
}

type ExecutedPreparedStmt<Stmt> = Effect.Effect<
	Stmt extends PgEffectPreparedQuery<infer T> ? T['execute'] : never,
	EffectDrizzleQueryError,
	DB
>

/**
 * Convenience function to reduce boilerplate for using prepared statements that query the database.
 *
 * The function returned automatically handles typing for the input based on the validation schema and using a transaction if one is provided.
 */
export function createPreparedQuery<
	VSchema extends StructLike,
	Stmt extends ReturnType<DB['Service']['_']['session']['prepareQuery']>,
>({vSchema, stmtFn}: {vSchema: VSchema; stmtFn: (qx: QueryExecutor) => Stmt}) {
	const stmtEffect = Effect.map(DB, (db) => stmtFn(db))

	const cachedStmt = stmtEffect.pipe(Effect.cached, Effect.flatten)

	return Effect.fn(function* (input: VSchema['Encoded'], tx?: Tx) {
		const parsed = yield* Schema.decodeUnknownEffect(vSchema)(input)

		/**
		 * Catches entities that are technically objects but cannot be used as input to prepared statements (like Dates, Maps, etc)
		 * @todo Define better type narrowing for VSchema so this is never reachable
		 */
		if (Array.isArray(parsed) || parsed.constructor !== Object) {
			return yield* Effect.die(
				new Error(
					`createPreparedQuery: schema must decode to a plain object, got ${parsed.constructor.name}`,
				),
			)
		}

		if (tx) {
			const txStmt = stmtFn(tx)

			// SAFETY: the guard above proves `parsed` is a plain object whose entries
			// the schema already validated; `Record<string, unknown>` is drizzle's own
			// driver contract for execute(), not a dictionary we designed.
			// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type
			return yield* txStmt.execute(parsed as Record<string, unknown>) as ExecutedPreparedStmt<Stmt>
		}

		const stmt = yield* cachedStmt

		// SAFETY: the guard above proves `parsed` is a plain object whose entries
		// the schema already validated; `Record<string, unknown>` is drizzle's own
		// driver contract for execute(), not a dictionary we designed.
		// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type
		return yield* stmt.execute(parsed as Record<string, unknown>) as ExecutedPreparedStmt<Stmt>
	})
}

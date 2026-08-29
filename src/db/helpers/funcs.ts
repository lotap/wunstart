import {and, inArray, type SQL} from 'drizzle-orm'
import type {EffectDrizzleQueryError} from 'drizzle-orm/effect-core'
import {createInsertSchema} from 'drizzle-orm/effect-schema'
import type {PgTable, PgColumn} from 'drizzle-orm/pg-core'
import type {PgEffectPreparedQuery} from 'drizzle-orm/pg-core/effect'
import {Effect, Schema} from 'effect'
import type {Constraint, SchemaError} from 'effect/Schema'
import type {SqlError} from 'effect/unstable/sql/SqlError'

import type {Tx, QueryExecutor} from '#/db/helpers/types.ts'
import {DB} from '#/db/index.ts'

/** Type that allows Record shaped schemas including Structs and Unions of Structs */
type StructLike = Constraint & {readonly Type: object}

type ArrayOfStructLikes = Constraint & {readonly Type: Array<object>}

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

export class ArchiveNotFoundError extends Schema.TaggedErrorClass<ArchiveNotFoundError>()(
	'ArchiveNotFoundError',
	{message: Schema.String},
) {}

/**
 * Thrown when the archive's delete removed fewer rows than its select found
 * (a concurrent writer archived a row between the two statements). The whole
 * archive transaction rolls back, so nothing partial is ever committed
 */
export class ArchiveCountMismatchError extends Schema.TaggedErrorClass<ArchiveCountMismatchError>()(
	'ArchiveCountMismatchError',
	{message: Schema.String},
) {}

/** An active table keyed by a uuid id column */
type ActiveTable = PgTable & {id: PgColumn & {_: {data: string; notNull: true}}}

/** An archive table: the active table plus the archiveId column */
type ArchiveTable = ActiveTable & {archiveId: PgColumn & {_: {data: bigint; notNull: true}}}

/** Reads the rows to archive for a given input, using an optional external transaction */
type ArchiveSelectFn<InputRecord, SelectCol> = (
	input: InputRecord,
	tx?: Tx,
) => Effect.Effect<SelectCol[], EffectDrizzleQueryError | SchemaError, DB>

/** An effect that records a dependency of the archived rows (cascade or delete) */
type ArchiveCascade = Effect.Effect<
	unknown,
	| EffectDrizzleQueryError
	| ArchiveNotFoundError
	| ArchiveCountMismatchError
	| SqlError
	| SchemaError,
	DB
>

/**
 * Shared machinery for {@link createArchiveFn} and {@link createArchiveManyFn}:
 * runs the selectFn in a transaction, inserts every returned row into the archive table,
 * runs the cascades, then runs the delete. The callers differ only in how the cascades
 * are keyed (by a single selector vs. by the full row data) and how the delete matches rows
 * (by a column equality vs. by the returned ids).
 */
function runArchival<
	InputRecord extends Record<string, string | bigint | number>,
	SelectCol extends {id: string},
	ArchiveValidation extends StructLike | undefined = undefined,
>({
	selectFn,
	archiveTable,
	archiveValidation,
	cascades,
	deleteRows,
	notFoundMessage,
}: {
	selectFn: ArchiveSelectFn<InputRecord, SelectCol>
	archiveTable: ArchiveTable
	archiveValidation?: ArchiveValidation
	cascades?: (
		tx: Tx,
		input: InputRecord,
		rows: SelectCol[],
		archiveIds: bigint[],
	) => ArchiveCascade[]
	deleteRows: (
		tx: Tx,
		input: InputRecord,
		rows: SelectCol[],
		archiveIds: bigint[],
	) => Effect.Effect<{id: string}[], EffectDrizzleQueryError | SchemaError, DB>
	notFoundMessage: (input: InputRecord) => string
}) {
	const _autoValidation = createInsertSchema(archiveTable)
	// SAFETY: custom archive validations are built from the same archive table via
	// createInsertSchema, so they stay compatible with the auto-derived schema's
	// insert contract.
	const archiveInsertValidations = (archiveValidation ?? _autoValidation) as typeof _autoValidation

	return Effect.fn(function* (
		input: InputRecord,
		{
			tx,
			extraData,
		}: {
			tx?: Tx
			extraData?: ArchiveValidation extends StructLike
				? Partial<ArchiveValidation['Encoded']>
				: Partial<(typeof _autoValidation)['Encoded']>
		} = {},
	) {
		const _archive = Effect.fn(function* (_tx: Tx) {
			// Find the existing row data
			const rowData = yield* selectFn(input, _tx)

			// Throw if none were found
			if (!rowData.length) return yield* new ArchiveNotFoundError({message: notFoundMessage(input)})

			// Insert the data into the archive table
			const archiveInsertValues = yield* Effect.forEach(rowData, (row) =>
				Schema.decodeUnknownEffect(archiveInsertValidations)({
					...row,
					...extraData,
				}),
			)

			const archiveRows = yield* _tx
				.insert(archiveTable)
				.values(archiveInsertValues)
				.returning({archiveId: archiveTable.archiveId})

			const archiveIds = archiveRows.map((row) => row.archiveId)

			/**
			 * Cascades run sequentially. Every statement serializes on the transaction's
			 * single connection anyway, so concurrency here only adds fibers, and an
			 * unbounded fan-out over a data-sized cascade list (one effect per archived
			 * row) would grow the transaction with the batch size.
			 */
			const cascadeEffects = cascades?.(_tx, input, rowData, archiveIds)
			if (cascadeEffects) yield* Effect.all(cascadeEffects)

			// Delete the row data from the active table
			const deletedRows = yield* deleteRows(_tx, input, rowData, archiveIds)

			/**
			 * A concurrent writer can archive a row between the select and the delete.
			 * The deletes match the selected rows by id (never by a looser selector),
			 * so deleted ⊆ selected always holds; when the counts differ, a row was
			 * archived elsewhere mid-transaction. Fail so the transaction rolls back
			 * instead of committing an archive row whose active row no longer exists.
			 */
			if (deletedRows.length !== rowData.length)
				return yield* new ArchiveCountMismatchError({
					message: `ARCHIVE ERROR: ROW COUNT MISMATCH: selected ${rowData.length}, deleted ${deletedRows.length}`,
				})

			return archiveRows
		})

		// Process with an external transaction if it exists
		if (tx) return yield* _archive(tx)

		// Process with a newly generated transaction
		const db = yield* DB
		return yield* db.transaction((_tx) => _archive(_tx))
	})
}

/**
 * Convenience function to reduce boilerplate for writing functions that archive rows for a given table
 *
 * Creates a transaction that confirms the row(s) exist, appends the existing data to an archive table,
 * processes given cascades, and finally removes the row(s).
 *
 * Archives every row the select function returns for a given selector. When a selector matches multiple
 * rows (e.g. selectBy: 'userId'), all of them are archived in one transaction (see archiveByUser in
 * sessions/cascades.ts).
 *
 * The function returned automatically handles typing for the input based on the select function provided and
 * can extend an external transaction to the query if necessary
 */
export function createArchiveFn<
	InputRecord extends Record<string, string | bigint | number>,
	SelectCol extends {id: string},
	ArchiveValidation extends StructLike | undefined = undefined,
>({
	selectFn,
	activeTable,
	archiveTable,
	// SAFETY: the default selector targets the primary key, which every archived
	// table defines and every caller's InputRecord keys by when the default is used.
	selectBy = 'id' as keyof InputRecord,
	cascades,
	archiveValidation,
	deleteWhere,
}: {
	selectFn: ArchiveSelectFn<InputRecord, SelectCol>
	activeTable: ActiveTable & Record<keyof InputRecord, PgColumn>
	archiveTable: ArchiveTable
	selectBy?: keyof InputRecord
	cascades?: (
		tx: Tx,
		selector: InputRecord[keyof InputRecord],
		archiveIds: bigint[],
	) => ArchiveCascade[]
	archiveValidation?: ArchiveValidation
	/** Extra conditions ANDed into the delete so it only removes rows still matching the caller's guard */
	deleteWhere?: (input: InputRecord) => SQL | undefined
}) {
	return runArchival<InputRecord, SelectCol, ArchiveValidation>({
		selectFn,
		archiveTable,
		archiveValidation,
		cascades: cascades
			? (tx, input, _rows, archiveIds) => cascades(tx, input[selectBy], archiveIds)
			: undefined,
		deleteRows: (tx, input, rows, _archiveIds) => {
			const conditions: SQL[] = [
				inArray(
					activeTable.id,
					rows.map((row) => row.id),
				),
			]
			const extra = deleteWhere?.(input)
			if (extra) conditions.push(extra)
			return tx
				.delete(activeTable)
				.where(and(...conditions))
				.returning({id: activeTable.id})
		},
		notFoundMessage: (input) =>
			`ARCHIVE ERROR: CANNOT FIND ROW WHERE ${String(selectBy)} = ${input[selectBy]}`,
	})
}

/**
 * Like {@link createArchiveFn}, but archives every row the select function returns in one transaction,
 * regardless of whether they share a selector value.
 *
 * Selects the rows, inserts them all into the archive table, hands the cascades the full row data
 * paired by index with the resulting archive ids, then deletes the rows by their ids. This lets the
 * select function use a range predicate (e.g. activities older than a retention window) with no
 * single column value tying the rows together.
 *
 * Cannot find any rows → {@link ArchiveNotFoundError}.
 */
export function createArchiveManyFn<
	InputRecord extends Record<string, string | bigint | number>,
	SelectCol extends {id: string},
	ArchiveValidation extends StructLike | undefined = undefined,
>({
	selectFn,
	activeTable,
	archiveTable,
	cascades,
	archiveValidation,
}: {
	selectFn: ArchiveSelectFn<InputRecord, SelectCol>
	activeTable: ActiveTable
	archiveTable: ArchiveTable
	cascades?: (tx: Tx, rows: SelectCol[], archiveIds: bigint[]) => ArchiveCascade[]
	archiveValidation?: ArchiveValidation
}) {
	return runArchival<InputRecord, SelectCol, ArchiveValidation>({
		selectFn,
		archiveTable,
		archiveValidation,
		cascades: cascades
			? (tx, _input, rows, archiveIds) => cascades(tx, rows, archiveIds)
			: undefined,
		deleteRows: (tx, _input, rows, _archiveIds) =>
			tx
				.delete(activeTable)
				.where(
					inArray(
						activeTable.id,
						rows.map((row) => row.id),
					),
				)
				.returning({id: activeTable.id}),
		notFoundMessage: (input) => `ARCHIVE ERROR: CANNOT FIND ROWS FOR ${JSON.stringify(input)}`,
	})
}

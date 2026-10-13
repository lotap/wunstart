# Queries + validations

Queries live in `queries.ts`, built with helpers from `db/helpers/funcs.ts`. Both accept an Effect Schema for input validation and auto-handle parsing + transaction passthrough. Always forward optional `tx`.

- `createPreparedQuery({vSchema, stmtFn})` (default): validated, statement-cached, `sql.placeholder` + `.prepare(name)`. Decoded result must be a plain object. Passing `tx` rebuilds uncached per call — only for use inside a transaction.
- `createQueryFn({vSchema, query: (qx, input) => ...})`: only for dynamic SQL that can't be prepared — e.g. `selectActivityIdsByTarget` (`activities---bans`), whose WHERE is built at runtime from the single narrowed scope instead of a six-way OR with unused placeholders.
`Tx = PgEffectTransaction`, `QueryExecutor = DB | Tx`.

## Placeholder + validation gotchas

- `sql.placeholder('x')` names must equal the validation's Encoded keys. Sometimes deliberately singular while the column is plural: `ipAddress` → `ARRAY[$1::inet]` over an `ipAddresses` column, with the validation renamed via `Struct.assign` to match.
- **Validations describe the STATEMENT INPUT, not the returned row.** `V.Select = pick(['id'])` coexists with `qx.select()` returning the whole row.
- `drizzle-orm/effect-schema`: `createInsertSchema` / `createSelectSchema` (see authoring below); statement outcomes as a `Union` of success/failure variants (see `Insert` in `models/activities/validations.ts`); `PGVerboseInterval` cutoff, `PositiveInt` limit, UUID.

## Query idioms

- `getColumns(table)` destructure to whitelist `returning` / omit secrets.
- Case-insensitive email: `lower(email) = lower(placeholder)` matching `uniqueIndex(lower(email))`.
- `host(ip)`, `unnest` / `array_agg(DISTINCT host(...))` for IP aggregation.
- `int8` returns string → `BigInt(total ?? 0)`.
- `eslint-plugin-drizzle` enforced as errors on your db tree: `enforce-delete-with-where`, `enforce-update-with-where`.

Canonical prepared select — the whole artifact in one place (`sql.placeholder` keys equal the validation's Encoded keys; `.prepare()` suffixed with `labelPrefix = tableName`; `getColumns` destructure keeps secrets out of `returning`/`select`):

```ts
const {passcodeHash, ...nonsensitiveCols} = getColumns(activeTable)
const {id} = nonsensitiveCols

export const select = createPreparedQuery({
	vSchema: V.Select, // statement input only: pick(['id'])
	stmtFn: (qx) =>
		qx
			.select(nonsensitiveCols)
			.from(activeTable)
			.where(eq(id, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_select`),
})
```

## Calling conventions

- Queries take `(input, tx?)` positionally and return rows: `const [session] = yield* sessionsQueries.select({id})`.
- Archives take `(input, {tx, extraData?})`: `archiveByUser({userId}, {tx, extraData: {usersArchiveId: archiveId}})`.
- Statement names are suffixed per query with `const labelPrefix = tableName` (`` `${labelPrefix}_select` ``, `_insert`, `_select_by_email`).

## Validations authoring

Primitives first, shapes second:

```ts
const overrides = {email: Email, passwordHash: Schema.optional(Schema.NullOr(Argon2Hash))} satisfies RefinementsFor<typeof activeTable>
const selectPrimitive = createSelectSchema(activeTable, overrides)
export const Select = selectPrimitive.mapFields(Struct.pick(['id']))
export const ByEmail = selectPrimitive.mapFields(Struct.pick(['email']))
```

Refine db-inferred types via the `overrides` second arg (`inet` needs manual handling — no automatic IP check); reshape with `pick` (subset) / `omit` (all-but) / `assign` (add or rename keys — renames align validation keys with `sql.placeholder` names) / `evolve` (transform types), nullables with `withNullDefault` / `NullishToNull`.

## Naming + imports

Queries are short verbs in a per-model namespace, imported as `* as <model>Queries` (`sessionsQueries`, `sessionsUsersQueries` for `---` dirs): `select` (by id, no suffix), `selectByX` / `archiveSelectByActiveId` for other filters, action verbs otherwise (`insert`, `updatePasswordHash`, `rotate`, `revoke`). No model name in the fn, no `bulk` prefix. Validation exports are statement-named PascalCase matching the query (`Insert`, `Select`, `ByX`, `Update…`). Cascades mirror queries: `archive`, `archiveByUser`, `archiveMany` (via `createArchiveFn` / `createArchiveManyFn`).

Model files stay self-contained. No barrel files under `models/` or `ops/` — import the file directly, always with the `.ts` extension on relative imports (`./schemas.ts`, never `./schemas` or a directory):

| File | Imports from |
| ---- | ------------ |
| `schemas.ts` | `drizzle-orm`, `drizzle-orm/pg-core` column builders, `db/helpers/consts.ts` + `tables.ts`, related models' `schemas.ts` |
| `validations.ts` | `drizzle-orm/effect-schema`, `effect`, `RefinementsFor` from `db/helpers/types.ts`, shared refinements from `db/helpers/validators.ts` (+ client-shared shapes from your app's shared validators), `./schemas.ts` |
| `queries.ts` | `drizzle-orm` operators, `createPreparedQuery` / `createQueryFn` from `db/helpers/funcs.ts`, `./schemas.ts`, `./validations.ts` (+ connected models' schemas/consts in `---` dirs) |
| `cascades.ts` | `createArchiveFn` from `db/helpers/funcs.ts`, `./queries.ts`, `./schemas.ts` (+ other models' schemas/cascades for re-pointing) |
| `consts.ts` | — (`UPPER_SNAKE` model constants consumed by ops / other models) |

# Queries + validations

Queries live in `queries.ts`, built with helpers from `db/helpers/query-fns.ts`. Both accept an Effect Schema for input validation and auto-handle parsing + transaction passthrough. Always forward optional `tx`.

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
- `host(ip)`, `unnest` / `array_agg(DISTINCT host(...))` for displaying IPs. Never for a key: `host()` drops the cidr mask, and ban/activity keys carry it (see `activities---bans/queries.ts`). Aggregate `ip_network` itself when the mask must survive.
- `appendUniqueBoundedSql(col, incoming, 32)` (`query-fns.ts`) for metadata arrays read back with `.at(-1)` (session device/location): plain `DISTINCT unnest` destroys recency, and re-visiting a value must move it to the end. JS twin `appendUniqueBounded` (`array-fns.ts`) — keep ordering and cap semantics aligned.
- Match a foreign-key violation by SQLSTATE (`extractPgCode` in `db/ops/_extract-pg-error.ts` returns `23503`); unique violations use the `UniqueViolation` reason tag. Never classify by the generic `ConstraintError` tag alone — NOT NULL (`23502`) and CHECK (`23514`) must stay internal errors. `extractPgErrorMessage` returns the driver’s generic “Query failed”, not the server’s constraint text.
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

`IpAddress` deliberately rejects IPv6 zone IDs (`fe80::1%eth0`) and embedded IPv4 with leading-zero octets (`::ffff:1.2.3.04`); Postgres `inet` rejects both with `22P02`. Pure IPv4 leading zeros are rejected too — stricter than `inet`, fail-safe, so an unparseable header value is dropped and the boundary falls through to the socket or fails closed, instead of a 500.

## Naming

Queries are short verbs in a per-model namespace, imported as `* as <model>Queries` (`sessionsQueries`, `sessionsUsersQueries` for `---` dirs). A name is the verb, then whatever the verb does not already say:

- **`select`** alone is by id, full row. Otherwise add projection, state, and predicate in that order: `selectProfile`, `selectActivityIdsByTarget`, `selectFromUnexpiredUnrevokedByUser`, `selectFromOldByCutoff`, `selectUserWithKnownIpByEmail` (a `---` join).
- **`insert` / `updateX` / `deleteByX`** for the row operations (`insertOrMergeMany` where the statement upserts), and a domain verb when the point is the effect rather than the row: `rotate`, `revoke`, `reserve`, `extendMany`, `incrementAttempts`.
- **`archive`** prefixes work on the twin: `archiveInsert`, `archiveSelectByActiveId`, `archiveAddVerified`.
- No model name in the fn, no `bulk` prefix.

The predicate and state words are the validation vocabulary — `By`, `With`, and `From` mean the same in both files, and a query bounded by an interval is `<verb>ByCutoff`, never `<verb>OlderThan`.

Cascades mirror queries: `archive`, `archiveByUser`, `archiveMany` (via `createArchiveFn` / `createArchiveManyFn`).

Validation exports name the input shape, not the query; the file's `/// INSERT | SELECT | UPDATE | DELETE ///` headers already state the operation.

- **Base shapes.** `Insert`, `Select`, and `Update` are reused by every query whose input is exactly that shape, however many there are — `V.Select` serves every unfiltered select. Naming one per query would copy the schema.
- **`By`** names the fields that decide which rows: keys, FKs, and range boundaries (`ByEmail`, `ByUser`, `ByEmailAndEntityId`, `ByCutoff`).
- **`With`** names a field the caller must prove or carry, not one that finds the row. `WithPasscode` finds the row by `id` and guards it with the hash; the hash stays `With` even though it sits in the `WHERE`, because the row is not found by it.
- **Verbs** stay for a mutation whose remainder is a field rather than a predicate: `Rotate`, `ExtendMany`, `InsertMany`, `UpdatePasswordHash`, `UpdateEmail`, `Reserve`. Test: delete the operation word — if the rest still says which rows these are, drop it; if it is only a column, keep it.
- **Prefixes and cardinality.** `Archive` marks the twin (`ArchiveInsert`, `ArchiveAddVerified`); `Many`/`Single` separates shapes that differ only in how many values they carry — array length (`InsertMany`, `ExtendMany`) or populated target dimensions (`ByManyTargets` / `BySingleTarget`).

One concept keeps one name across models: a cutoff boundary is `ByCutoff` whether the query selects or deletes.

Model files stay self-contained — per-file import rules live in Module anatomy (`SKILL.md`); naming below.

# Queries + validations

Queries live in `queries.ts`, built with helpers from `src/db/helpers/funcs.ts`. Both accept an Effect Schema for input validation and auto-handle parsing + transaction passthrough. Always forward optional `tx`.

- `createPreparedQuery({vSchema, stmtFn})` (default): validated, statement-cached, `sql.placeholder` + `.prepare(name)`. Decoded result must be a plain object. Passing `tx` rebuilds uncached per call — only for use inside a transaction.
- `createQueryFn({vSchema, query: (qx, input) => ...})`: only for dynamic SQL that can't be prepared — e.g. `selectActivityIdsByTarget` (`activities---bans`), whose WHERE is built at runtime from the single narrowed scope instead of a six-way OR with unused placeholders.
`Tx = PgEffectTransaction`, `QueryExecutor = DB | Tx`.

## Placeholder + validation gotchas

- `sql.placeholder('x')` names must equal the validation's Encoded keys. Sometimes deliberately singular while the column is plural: `ipAddress` → `ARRAY[$1::inet]` over an `ipAddresses` column, with the validation renamed via `Struct.assign` to match.
- Validations describe the STATEMENT INPUT, not the returned row. `V.Select = pick(['id'])` coexists with `qx.select()` returning the whole row.
- `drizzle-orm/effect-schema`: `createInsertSchema` / `createSelectSchema` + RefinementsFor overrides (e.g. Email, IpAddress, Argon2Hash; `inet` needs manual handling). Shape via `.mapFields(pick/omit/assign/evolve)`; nullables with `withNullDefault` / `NullishToNull`; success/failure `Union([InsertSuccess, InsertFailure])` with `Literal(true/false)`; `PGVerboseInterval` cutoff, `PositiveInt` limit, UUID.

## Query idioms

- `getColumns(table)` destructure to whitelist `returning` / omit secrets.
- Case-insensitive email: `lower(email) = lower(placeholder)` matching `uniqueIndex(lower(email))`.
- `host(ip)`, `unnest` / `array_agg(DISTINCT host(...))` for IP aggregation.
- `int8` returns string → `BigInt(total ?? 0)`.
- `eslint-plugin-drizzle` enforced as errors on `src/db/**`: `enforce-delete-with-where`, `enforce-update-with-where`.

## Naming + imports

Queries are short verbs in a per-model namespace, imported as `* as <model>Queries` (`sessionsQueries`, `sessionsUsersQueries` for `---` dirs): `select` (by id, no suffix), `selectByX` / `archiveSelectByActiveId` for other filters, action verbs otherwise (`insert`, `updatePasswordHash`, `rotate`, `revoke`). No model name in the fn, no `bulk` prefix. Cascades mirror queries: `archive`, `archiveByUser`, `archiveMany` (via `createArchiveFn` / `createArchiveManyFn`).

Model files stay self-contained:

| File | Imports from |
| ---- | ------------ |
| `schemas.ts` | `drizzle-orm`, `drizzle-orm/pg-core` column builders, `#/db/helpers/consts.ts` + `tables.ts`, related models' `schemas.ts` |
| `validations.ts` | `drizzle-orm/effect-schema`, `effect`, `RefinementsFor` from `#/db/helpers/types.ts`, shared refinements from `#/db/helpers/validators.ts` (+ client-shared shapes from `#/isomorphic/validators.ts`), `./schemas.ts` |
| `queries.ts` | `drizzle-orm` operators, `createPreparedQuery` / `createQueryFn` from `#/db/helpers/funcs.ts`, `./schemas.ts`, `./validations.ts` (+ connected models' schemas/consts in `---` dirs) |
| `cascades.ts` | `createArchiveFn` from `#/db/helpers/funcs.ts`, `./queries.ts`, `./schemas.ts` (+ other models' schemas/cascades for re-pointing) |
| `consts.ts` | — (`UPPER_SNAKE` model constants consumed by ops / other models) |

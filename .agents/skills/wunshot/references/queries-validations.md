# Queries + validations

Queries live in `queries.ts`, built with helpers from `src/db/helpers/funcs.ts`. Both accept an Effect Schema for input validation and auto-handle parsing + transaction passthrough. Always forward optional `tx`.

- `createPreparedQuery({vSchema, stmtFn})` (default): validated, statement-cached, `sql.placeholder` + `.prepare(name)`. Decoded result must be a plain object. Passing `tx` rebuilds uncached per call — only for use inside a transaction.
- `createQueryFn({vSchema, query: (qx, input) => ...})`: only for dynamic SQL that can't be prepared.

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

# Tables + archive pairs

New-module recipe, in order: `schemas.ts` → `validations.ts` → `queries.ts` → `cascades.ts` → (`consts.ts` if shared constants) → op in `db/ops/<domain>/` (see `references/ops-contract.md`). No registration step: the drizzle-kit glob auto-discovers `*schemas.ts`, and twins migrate together (`drizzle-kit generate` / `check`).

1. `schemas.ts`: hand-write `export const tableName = 'snake_case'`; extract shared `baseCols` when twins share columns (see `bans`), duplicate when PII diverges (see `users`); FK refs lazy, e.g. `usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId)`; PII columns nullable in the archive twin (erasure keeps the row + FKs while wiping identity).
2. `validations.ts`: primitives via `createInsertSchema` / `createSelectSchema` + `RefinementsFor`; shape with `pick` / `omit` / `assign` / `evolve` (see `references/queries-validations.md`).
3. `queries.ts`: `const labelPrefix = tableName`; `getColumns` destructure to whitelist `returning`; `createPreparedQuery({vSchema, stmtFn})` with `.prepare()` suffixed per query (`` `${labelPrefix}_select` ``, `_insert`, `_select_by_email`); forward optional `tx`. Query/cascade naming: see `Naming + imports` in `references/queries-validations.md`.
4. `cascades.ts`: `createArchiveFn({selectFn, activeTable, archiveTable})` (+ `…ByX` variants); re-point related rows with `extraData: {xArchiveId}` (FK redirect onto the new archive row, e.g. `archiveByUser({userId}, {tx, extraData: {usersArchiveId: archiveId}})`); `Effect.catchTags({ArchiveNotFoundError: () => Effect.void, …})` for optional children.
5. Verify: typecheck + lint + `drizzle-kit check`.

Every domain table has an active twin and an archive twin. Deletes never touch the active row in place: `createArchiveFn` (in `db/helpers/funcs.ts`) selects → inserts into archive (validate + `extraData`) → runs domain cascades → deletes active rows with `id IN (...)` + optional `deleteWhere` CAS guard → count-checks. Count mismatch rolls back as typed `ArchiveCountMismatchError`; zero rows is `ArchiveNotFoundError`. Recover with `Effect.catchTags({ArchiveNotFoundError: () => Effect.void, ArchiveCountMismatchError: () => Effect.void})` (`catchTag` for a single tag). Batched system archivals loop with a batch limit until short (e.g. 500); NotFound/Mismatch → `[]` stops (next run resumes).

## Factories (`db/helpers/tables.ts`, all wrap `snakeCase.table`)

- `createActiveTable(name, cols)`: adds `id` uuid PK defaultRandom, `createdAt`/`updatedAt` timestamptz defaultNow + `$onUpdate`
- `createArchiveTable(name, cols)`: adds `id` uuid NOT NULL (plain, not PK, no defaults — machinery copies values), `createdAt`/`updatedAt` (no defaults), `archiveId` bigint identity PK, `archivedAt` defaultNow. PII columns go nullable here
- `createActiveLogTable` / `createArchiveLogTable`: `id` + `timestamp` (log tables); archive adds `archiveId`/`archivedAt`. The activities archive twin drops the active twin's `default(1)` on `weight` (active-only default).

Rejected: `deleted_at` column (dangling FKs), hard delete (loses audit), event sourcing (overkill), JSONB snapshot (unqueryable).

## Column gotchas

- `snakeCase.table` snake_cases COLUMN KEYS ONLY; table name passes through verbatim. No column helper exists — don't invent one. Hand-write `export const tableName = 'email_verifications'` in snake_case. TS access stays camelCase; only SQL is snake_case. Hand-written fragments must spell `EXCLUDED.ip_addresses`.
- Always `timestamp(TIMESTAMPTZ_CONFIG)`; never inline `{withTimezone: true}`. Archive id always `bigint('archive_id', ...)` via `ARCHIVE_ID_CONFIG` outside `tables.ts`; never inline `{mode: 'bigint'}` in schemas (the factory itself spells the full column def).
- `inet().array()` / `uuid().array()` for ban `activityIds` (PG can't FK arrays — no FK by design, cascade owns integrity).
- SQL defaults need nowrap `sql'...'` (no params).
- CTE aliases `.as('snake_case')`.
- Partial index `.where(sql'...')` needs a matching `isNotNull` guard on the same column.
- Never `pgEnum` outside a `---` dir. No `onDelete` / `onUpdate` / `foreignKey()` anywhere — plain FKs via `.references(() => …)`. Cascades re-point: `set({usersArchiveId: archiveId, userId: null})`.
- `$onUpdate` is ORM-layer, not a DB trigger. Zero `TRIGGER` in migrations. Hand-written cascade SQL doesn't bump `updated_at`.
- Optimistic concurrency via compare-and-swap in the WHERE (e.g. `updatePasswordHashIfMatches` matches the old hash) instead of read-then-write.

## Data-structure values

Schemas stay as self-contained as reasonable: arrays as column types (`inet().array()` / `uuid().array()` for ban `activityIds`), denormalized data. Application flexibility over DB rigidity — most logic changes should not need a migration. `text` over `varchar(n)` or enums for new columns (legacy `varchar(254/255)` in `users`/`bans` predates this); an enum only for values never expected to grow (e.g. `banScopes`). Check constraints sparingly (each one needs a migration, and every existing row must pass): Effect schemas are the source of truth for data integrity, not the DB.

## Why archive pairs (not soft deletes)

Benefits: FKs enforced at the DB layer instead of the ORM layer, no `is_deleted = false` filters in queries, distinct data states that are easy to reason about. Tradeoffs: schema complexity (twin tables + live/archive FK columns), migration overhead (twins update together), archive cost (select + insert + cascade updates + delete in one tx — fine, deletes are never hot).

The point is failing early. The live FK blocks the delete until those rows are re-pointed (`set({usersArchiveId: archiveId, userId: null})`), forcing the author to consider impacted relations now instead of discovering the inconsistency months later.

# Tables + archive pairs

New-module recipe, in order: `schemas.ts` → `validations.ts` → `queries.ts` → `cascades.ts` → (`consts.ts` if shared constants) → op in `db/ops/<domain>/` (see `references/ops-contract.md`; add the narrowest messages file when a scope emits user-facing copy). No registration step: the drizzle-kit glob auto-discovers `*schemas.ts`, and twins migrate together (`drizzle-kit generate` / `check`).

1. `schemas.ts`: hand-write `export const tableName = 'snake_case'`; name the archive twin `` `${tableName}_archive` ``; extract shared `baseCols` when twins share columns (see `bans`), duplicate when PII diverges (see `users`); FK refs lazy, e.g. `usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId)`; PII columns nullable in the archive twin (erasure keeps the row + FKs while wiping identity). Unique keys via the third arg, `extraConfig: (t) => [uniqueIndex(...)]` (see `email-verifications`). Archive-twin FK mirror: every `xId` FK gains an `xArchiveId` (`bigint` → that twin's `archiveId`) alongside the nullable original.
2. `validations.ts`: primitives via `createInsertSchema` / `createSelectSchema` + `RefinementsFor`; shape with `pick` / `omit` / `assign` / `evolve` (see `references/queries-validations.md`).
3. `queries.ts`: `const labelPrefix = tableName`; `getColumns` destructure to whitelist `returning`; `createPreparedQuery({vSchema, stmtFn})` with `.prepare()` suffixed per query (`` `${labelPrefix}_select` ``, `_insert`, `_select_by_email`); forward optional `tx`. Query/cascade naming: see `Naming` in `references/queries-validations.md`.
4. `cascades.ts`: `createArchiveFn({selectFn, activeTable, archiveTable})` (+ `…ByX` variants); re-point related rows with `extraData: {xArchiveId}` (FK redirect onto the new archive row, e.g. `archiveByUser({userId}, {tx, extraData: {usersArchiveId: archiveId}})`); `Effect.catchTag('ArchiveNotFoundError', () => Effect.void)` for optional children — never catch the count mismatch here (see below).
5. FKs a core model? Extend that model's `cascades.ts` now — the owner's delete fails on the FK until you do. Which form (per-user archival call vs in-place re-point + sweep): see `references/module-walkthrough.md`.
6. Verify: typecheck + lint + `drizzle-kit check`.

Every domain table that records a fact has an active twin and an archive twin. Deletes never touch the active row in place: `createArchiveFn` (in `db/helpers/archive-fns.ts`) selects → inserts into archive (validate + `extraData`) → runs domain cascades → deletes active rows with `id IN (...)` + optional `deleteWhere` CAS guard → count-checks. Zero rows is `ArchiveNotFoundError`; a concurrent archive can make the delete remove fewer rows than the select found, which rolls back as `ArchiveCountMismatchError`.

The archive pair protects facts, not rows, so the test is whether the row is the only copy of something the product must still be able to explain. `auth-attempts` is the shipped exception: it holds one fixed-window count row per target, while the presentations it counts are already activities — the signing ops log success, failure, and denial through the one logging path — in a table that is retained and then archived. The table is a materialized aggregate over that stream, which is exactly why the hot path can be a keyed upsert instead of a windowed sum. A twin would keep the same facts twice, in less detail, forever.

A table that fails the test declares its composite key on `snakeCase.table` directly (no factory: no surrogate `id`, no lifecycle timestamps), keeps no twin, and is swept by age. The shape is also forced mechanically: `createArchiveFn` selects and deletes by `id`, and `createArchiveTable` requires one, so a keyed table has no archive path to run. When the key is an email or a network, a twin would additionally be a permanent PII copy with no FK to scrub on account deletion.

Never use that shape for entity or event data, or for a table that is the only copy of a fact. Being small, or swept, is not the test; having no fact of its own is.

Recovering depends on who owns the transaction. Without a `tx`, the archive call opens its own, so catching either error outside it is safe — nothing was committed, a sweep can stop with `[]`, and the next run resumes (batched system archivals loop until a short batch, e.g. 500 rows). Inside a transaction you share with the caller, catch `ArchiveNotFoundError` only: catching the mismatch would commit this cascade’s archive insert as a duplicate, so let it roll the whole transaction back and give the caller `retryTransientOrArchiveRace`. Linted by `wunshot/no-catch-archive-count-mismatch-in-tx`.

## Factories (`db/helpers/table-fns.ts`, all wrap `snakeCase.table`)

- `createActiveTable(name, cols)`: adds `id` uuid PK defaultRandom, `createdAt`/`updatedAt` timestamptz defaultNow + `$onUpdate`
- `createArchiveTable(name, cols)`: adds `id` uuid NOT NULL (plain, not PK, no defaults — machinery copies values), `createdAt`/`updatedAt` (no defaults), `archiveId` bigint identity PK, `archivedAt` defaultNow. PII columns go nullable here
- `createActiveLogTable` / `createArchiveLogTable`: `id` + `timestamp` (log tables); archive adds `archiveId`/`archivedAt`. The activities archive twin drops the active twin's `default(1)` on `weight` (active-only default).

Every factory here contributes default columns. The ephemeral-count-table exception above therefore uses none: it calls `snakeCase.table(tableName, cols, (t) => [primaryKey({columns: […]})])` straight from its `schemas.ts`.

Rejected: `deleted_at` column (dangling FKs), hard delete (loses audit), event sourcing (overkill), JSONB snapshot (unqueryable).

## Column gotchas

- `snakeCase.table` snake_cases COLUMN KEYS ONLY; table name passes through verbatim. No column helper exists — don't invent one. Hand-write `export const tableName = 'email_verifications'` in snake_case. TS access stays camelCase; only SQL is snake_case. Hand-written fragments must spell `EXCLUDED.ip_addresses`.
- Always `timestamp(TIMESTAMPTZ_CONFIG)`; never inline `{withTimezone: true}`. Archive id always `bigint('archive_id', ...)` via `ARCHIVE_ID_CONFIG` outside `table-fns.ts`; never inline `{mode: 'bigint'}` in schemas (the factory itself spells the full column def).
- `inet().array()` / `uuid().array()` for ban `activityIds` (PG can't FK arrays — no FK by design, cascade owns integrity).
- SQL defaults need nowrap `sql'...'` (no params). A default built from a module constant splices it with ``sql.raw(`now() + '${PASSCODE_EXPIRATION}'::interval`)``, because a bound param is illegal there; keep the emitted text identical so `db:generate` reports no schema change.
- CTE aliases `.as('snake_case')`.
- Partial index `.where(sql'...')` needs a matching `isNotNull` guard on the same column.
- Enums live in a `schemas.ts`: the owning model's file for its own closed set, or the shared `---` dir's `schemas.ts` when several models use them (e.g. `banScopes`). No `onDelete` / `onUpdate` / `foreignKey()` anywhere — plain FKs via `.references(() => …)`. Cascades re-point: `set({usersArchiveId: archiveId, userId: null})`.
- `$onUpdate` is ORM-layer, not a DB trigger. Zero `TRIGGER` in migrations. Hand-written cascade SQL doesn't bump `updated_at`.
- Optimistic concurrency via compare-and-swap in the WHERE (e.g. `updatePasswordHashIfMatches` matches the old hash) instead of read-then-write.

## Data-structure values

Schemas stay as self-contained as reasonable: arrays as column types (`inet().array()` / `uuid().array()` for ban `activityIds`), denormalized data. Application flexibility over DB rigidity — most logic changes should not need a migration. `text` over `varchar(n)` or enums for new columns (legacy `varchar(254/255)` in `users`/`bans` predates this); an enum only for values never expected to grow (e.g. `banScopes`). Check constraints sparingly (each one needs a migration, and every existing row must pass): Effect schemas are the source of truth for data integrity, not the DB.

## Why archive pairs (not soft deletes)

Benefits: FKs enforced at the DB layer instead of the ORM layer, no `is_deleted = false` filters in queries, distinct data states that are easy to reason about. Tradeoffs: schema complexity (twin tables + live/archive FK columns), migration overhead (twins update together), archive cost (select + insert + cascade updates + delete in one tx — fine, deletes are never hot).

The point is failing early. The live FK blocks the delete until those rows are re-pointed (`set({usersArchiveId: archiveId, userId: null})`), forcing the author to consider impacted relations now instead of discovering the inconsistency months later.

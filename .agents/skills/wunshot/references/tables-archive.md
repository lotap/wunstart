# Tables + archive pairs

Every domain table has an active twin and an archive twin. Deletes never touch the active row in place: `createArchiveFn` (in `src/db/helpers/funcs.ts`) selects → inserts into archive (validate + `extraData`) → runs domain cascades → deletes active rows with `id IN (...)` + optional `deleteWhere` CAS guard → count-checks. Count mismatch rolls back as typed `ArchiveCountMismatchError`; zero rows is `ArchiveNotFoundError`. Recover with `Effect.catchTags({ArchiveNotFoundError: () => Effect.void, ArchiveCountMismatchError: () => Effect.void})`. System batches loop `limit: 500` until short; NotFound/Mismatch → `[]` stops (next cron resumes).

## Factories (`src/db/helpers/tables.ts`, all wrap `snakeCase.table`)

- `createActiveTable(name, cols)`: adds `id` uuid PK defaultRandom, `createdAt`/`updatedAt` timestamptz defaultNow + `$onUpdate`
- `createArchiveTable(name, cols)`: adds `id` uuid NOT NULL (plain, not PK, no defaults — machinery copies values), `createdAt`/`updatedAt` (no defaults), `archiveId` bigint identity PK, `archivedAt` defaultNow. PII columns go nullable here
- `createActiveLogTable` / `createArchiveLogTable`: `id` + `timestamp` (log tables); archive adds `archiveId`/`archivedAt` and drops `default(1)` weight

Rejected: `deleted_at` column (dangling FKs), hard delete (loses audit), event sourcing (overkill), JSONB snapshot (unqueryable).

## Column gotchas

- `snakeCase.table` snake_cases COLUMN KEYS ONLY; table name passes through verbatim. No `snakeCase.column` exists in drizzle rc4. Hand-write `export const tableName = 'email_verifications'` in snake_case. TS access stays camelCase; only SQL is snake_case. Hand-written fragments must spell `EXCLUDED.ip_addresses`.
- Always `timestamp(TIMESTAMPTZ_CONFIG)`; never inline `{withTimezone: true}`. Archive id always `bigint('archive_id', ...)` via `ARCHIVE_ID_CONFIG`; never inline `{mode: 'bigint'}`.
- `inet().array()` / `uuid().array()` for ban `activityIds` (PG can't FK arrays — no FK by design, cascade owns integrity).
- SQL defaults need nowrap `sql'...'` (no params). CTE aliases `.as('snake_case')`. Partial index `.where(sql'...')` needs matching `isNotNull` guard. Single-target bans: `unique().nullsNotDistinct()` + `check(num_nonnulls() = 1)`.
- `$onUpdate` is ORM-layer, not a DB trigger. Zero `TRIGGER` in migrations. Hand-written cascade SQL doesn't bump `updated_at`.
- Never `pgEnum` outside a `---` dir. No `onDelete` / `onUpdate` / `foreignKey()` anywhere. Cascades re-point: `set({usersArchiveId: archiveId, userId: null})`.
- Shared `baseCols` spread + divergent cols per twin.

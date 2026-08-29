# ADR 0006: Active/archive table pairs for soft-delete with referential integrity

**Status**: Accepted  
**Date**: 2026-05-30

Every domain table has an active twin and an archive twin. Deletes don't touch the active row. Instead, `createArchiveFn` moves it to the archive table in a transaction, updates all foreign-key references to point to the archive row (via `archiveId`), then deletes the active row. Activities, bans, and other audit tables keep valid references forever; the archive table preserves the full row history.

## Considered options

| Option | Why rejected |
|--------|-------------|
| **`deleted_at` column** | FKs from activities/bans would dangle or need nullable FKs. A report filed by a deleted user would reference a row that looks active but isn't. |
| **Hard delete with no history** | Breaks audit trail. A user's reports and bans would lose authorship context. |
| **Event sourcing for everything** | Overkill for the current feature set. The archive table gives us the audit benefit without replay complexity. |
| **JSONB snapshot on delete** | Loses queryability. Archive rows are real tables with real columns and indexes. |

## Consequences

- Every domain gets two table definitions (active + archive) and two schema files. Drizzle config auto-discovers both via the `*(schema|view)s.ts` glob.
- `createArchiveFn` in `src/db/helpers/funcs.ts` handles the move + cascade + delete in a single transaction. Domain-specific cascades live in `cascades.ts` files.
- No FK enforcement from archive tables back to active tables (by design, since the active row is gone). Application logic in `createArchiveFn` prevents orphaned references.
- `archiveId` is a generated bigint identity, not a UUID, for compact indexing in the high-write activities/bans tables.
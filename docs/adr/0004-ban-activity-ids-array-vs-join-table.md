# ADR 0004: Use arrays over join tables for ban activity IDs

**Status**: Accepted
**Date**: 2026-06-14

## Context

The `bans` table tracks which activities contributed to a ban. When a ban is created (e.g., an IP exceeds the rate-limit threshold), the ban row needs to reference the specific `activities` rows that triggered it. The references support auditing, extending the ban if the behaviour continues, and recording what caused the ban. The typical relational approach is a join table (`ban_activities`), but the cardinality is small (1-60 activities per ban) and the lifecycle is write-once then archival.

## Decision

Use PostgreSQL arrays (`uuid[]` and `bigint[]`) on the `bans` row rather than a join table. The `bans` table stores `activityIds` (uuid[]) and `activitiesArchiveIds` (bigint[]). Queries use `ANY()` joins to match activities to bans.

## Considered options

| Option | Why rejected |
|--------|-------------|
| **Join table (`ban_activities`)** | Adds a table, requires multiple INSERTs per ban creation (one per activity), and introduces FK management overhead. For 1-60 rows per ban, the write and query overhead isn't justified. |
| **JSONB column** | Harder to query with `ANY()` or index. Arrays of native types get GIN index support and proper type safety. |

## Rationale

### Why arrays work here

- The `ANY()` join pattern (`WHERE id = ANY(bans.activityIds)`) is faster than joining through a junction table for small cardinalities (1-60 items per ban). A GIN index on the array column can accelerate these queries if needed.
- Writes are simpler: a single `UPDATE` with `array_append` or `array_cat` vs. multiple `INSERT` statements into a junction table. Ban creation is a transactional operation that already touches multiple tables, so eliminating one table and N INSERTs reduces failure surface.
- Activities are never hard-deleted. They move to archive tables via the active/archive pattern (ADR 0006). The archive cascade updates `activitiesArchiveIds` on bans, keeping references valid without FK enforcement.

### Why no FK constraints?

PostgreSQL doesn't support foreign-key constraints on array elements. Without arrays, we'd need a junction table with FKs to get referential integrity. But since activities are never deleted (only archived), the risk of orphaned IDs is managed by application logic in the archive cascade, not database constraints.

## Consequences

- No FK enforcement on `activityIds` or `activitiesArchiveIds`. Orphaned IDs are prevented by application logic (the archive cascade), not database constraints.
- A GIN index on `activityIds` may be needed if query performance degrades as ban volume grows.
- Cross-table queries use `ANY()` patterns (`WHERE id = ANY(bans.activityIds)`) which are well-supported by PostgreSQL but require developers to remember the pattern instead of standard JOIN syntax.
- If cardinality per ban grows beyond ~60 items, reconsider a junction table, since the array approach degrades as element count increases.

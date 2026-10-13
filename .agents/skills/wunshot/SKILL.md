---
name: wunshot
description: |
  Portable Drizzle + Postgres + Effect database-module system. Use when defining tables, queries, validations, cascades, archive pairs, ban/activity references, or Effect ops with activity logging. Applies to any project consuming wunshot registry modules, regardless of frontend or runtime. For TanStack Start routes, middleware, cookies, Cloudflare Workers, or email transport wiring, use the wunstart skill instead.
---

# Wunshot

Collection of copy-paste database modules (schemas + functions) on Drizzle ORM + Postgres + Effect. Frontend-agnostic, runtime-agnostic. This repo is canonical; the standalone `wunshot` registry backfills from here.

## Module anatomy

Each domain lives in `src/db/models/<domain>/`:

| File | Purpose |
| ---- | ------- |
| `schemas.ts` | Table definitions via factories. Only `*schemas.ts` / `*views.ts` under `models/` are discovered by drizzle-kit glob |
| `queries.ts` | Prepared queries via helpers |
| `validations.ts` | Statement-input schemas via `drizzle-orm/effect-schema` |
| `cascades.ts` | Archive/delete cascade logic |
| `consts.ts` | Domain constants (optional) |

Cross-domain joins use `---` dirs (e.g. `activities---bans`): queries only, never tables of their own. Never add `relations()` calls.

## Hard rules

- **Never `pgTable` directly.** Use factories in `src/db/helpers/tables.ts` (all wrap `snakeCase.table`). Linted by `wunshot/no-pgtable-direct`.
- **Effect Schema only.** No zod, no valibot. Bridge via `drizzle-orm/effect-schema`. Linted by `wunshot/no-zod-valibot`.
- **Every table has an active + archive pair.** Deletes move rows, never hard-delete audit data. See `references/tables-archive.md`.
- **Denials never carry `failedCredential`.** Pass email as `meta: {credential}` for audit only. Linted by `wunshot/no-failed-credential-in-denial`.
- **`failureCause` and activity `label` stay free-form text.** Deliberate maintenance decision; do not "fix" into enums.
- **Ops ship here; server functions do not.** Ops are pure Effect + layers. Cookie handling, routing, and `runOp` call sites live in the consumer (wunstart skill).

## Branch chooser

Read only what the task needs:

- Tables, factories, archive pairs, column gotchas: `references/tables-archive.md`
- Prepared queries, query fns, validations, drizzle gotchas: `references/queries-validations.md`
- Op skeleton, `opsFailure`, labels, retry, hashing order, error contract: `references/ops-contract.md`
- Weight routing, ban scopes, array references: `references/bans.md`

Project Effect conventions take precedence over vendored `effect` / `effect-ts` skills.

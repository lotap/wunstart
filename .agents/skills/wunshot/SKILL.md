---
name: wunshot
description: |
  Portable Drizzle + Postgres + Effect database-module system. Use when finding/installing wunshot core modules or writing custom modules: tables, queries, validations, cascades, archive pairs, ban/activity references, or Effect ops with activity logging. Applies to any host project, regardless of frontend, runtime, or tree layout. Routing, middleware, cookies, and transport wiring belong to your app — this skill covers only the portable DB modules.
---

# Wunshot

Collection of copy-paste database modules (schemas + functions) on Drizzle ORM + Postgres + Effect. Frontend-agnostic, runtime-agnostic. These modules are developed in wunstart and distributed via the wunshot registry; the conventions here are the source of truth.

Portability: paths (`src/db/…`), the `#/` import alias, and script names below are wunstart's layout, shown concretely. In your project map module root → your db tree, `#/` → your alias, scripts → your equivalents. The invariants are the module-internal structure (`<domain>/{schemas,queries,validations,cascades,consts}`), the factory/helper contracts, and the op shape — those travel unchanged. Use your project's domain vocabulary in copy and code names.

## Module anatomy

Each domain lives in `src/db/models/<domain>/`:

| File | Purpose |
| ---- | ------- |
| `schemas.ts` | Table definitions via factories. Only `*schemas.ts` under `models/` are discovered by drizzle-kit glob (the glob also matches `*views.ts`; none exist yet) |
| `queries.ts` | Prepared queries via helpers |
| `validations.ts` | Statement-input schemas via `drizzle-orm/effect-schema` |
| `cascades.ts` | Archive/delete cascade logic |
| `consts.ts` | Domain constants (optional) |

Cross-domain joins use `---` dirs (e.g. `activities---bans`): queries + validations, never tables of their own (a shared enum may live in their `schemas.ts`). Never add `relations()` calls — the Drizzle init carries no schema object, so the relational Query API is unavailable; cross-model reads go in `---` dirs with explicit joins.

Top-level `src/db/helpers/` serves all models: `tables.ts` (factories), `funcs.ts` (`createPreparedQuery` / `createQueryFn` / `createArchiveFn` / `createArchiveManyFn`), `consts.ts` (shared constants), `types.ts` (`Tx`, `QueryExecutor`, …), `validators.ts` (shared Effect refinements: `Email`, `IpAddress`, `Argon2Hash`, …).

## Hard rules

- **Never `pgTable` directly.** Use factories in `src/db/helpers/tables.ts` (all wrap `snakeCase.table`). Linted by `wunshot/no-pgtable-direct`.
- **Effect Schema only.** No zod, no valibot. Bridge via `drizzle-orm/effect-schema`. Linted by `wunshot/no-zod-valibot`.
- **Every table has an active + archive pair.** Deletes move rows, never hard-delete audit data. See `references/tables-archive.md`.
- **Denials never carry `failedCredential`.** Pass email as `meta: {credential}` for audit only. Linted by `wunshot/no-failed-credential-in-denial`.
- **`failureCause` and activity `label` stay free-form text.** Deliberate maintenance decision; do not "fix" into enums.
- **Ops ship here; server functions do not.** Ops are pure Effect + layers. Cookie handling, routing, and op call sites live in the consumer (your app's router/server layer).

## Stale upstream docs

`wunshot.dev/getting-started/the-wunshot-way/` predates this skill. Where they disagree, this skill wins:

| Site says | Do this instead |
| --------- | --------------- |
| Valibot (`drizzle-valibot`, `safeParse`) | Effect Schema (`drizzle-orm/effect-schema`) |
| `selectUserByEmail`, `bulk` prefix | `<model>Queries` namespace (`usersQueries.selectByEmail`) |
| `cols.ts` | `tables.ts` factories + `funcs.ts` helpers |
| `relations.ts` | Never; cross-model reads go in `---` dirs |
| `OpsSafeReturn` `{success, data}` + `failureOutputMessages` | `createOpsFn` + `opsFailure` |
| `internals/` dirs | `_`-prefixed files |
| `viaTx` + label | Forward optional `tx` |

## Verifying

No product tests ship with the modules. Self-check a new/changed module with your project's equivalents of: typecheck (`tsgo --noEmit` / `tsc`), lint (including the three wunshot rules above), and `drizzle-kit check` after any schema edit (twins migrate together).

## Philosophy (the wunshot way)

Ship-first, scale-later: everything a new project needs to handle its first users. Easy to start (no structuring decisions left to make), easy to learn (organized, readable, repeatable), easy to eject (copy-paste modules you own — no lock-in).

MORV: Model (migrations, connections, queries) + Operation (business logic, composes queries, formats responses, owns ALL error handling — no per-level catch, bubble everything up) + Router (HTTP, cookies, redirects — outside wunshot, owned by the consumer) + View. The op/router split keeps wunshot frontend-agnostic and answers "where does this logic go".

- Repeated code beats early abstractions; optimize for deletion (whichever solution is easier to remove wins).
- Validate then database: malformed input dies before connections open.
- Server-side processing over DB functions (portable, scales horizontally); exception: dates via DB `now()` (timezone/latency consistency).
- Casing: files `kebab-case`; columns `snake_case` SQL / `camelCase` TS; types + validations `PascalCase`; exported consts + env `UPPER_SNAKE`; everything else `camelCase`.

## Branch chooser

Read only what the task needs:

- Tables, factories, archive pairs, column gotchas: `references/tables-archive.md`
- Prepared queries, query fns, validations, drizzle gotchas: `references/queries-validations.md`
- Op skeleton, `opsFailure`, labels, retry, hashing order, error contract: `references/ops-contract.md`
- Weight routing, ban scopes, array references: `references/bans.md`

Project Effect conventions take precedence over vendored `effect` / `effect-ts` skills.

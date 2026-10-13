---
name: wunshot
description: |
  Portable Drizzle + Postgres + Effect database-module system. Use when finding/installing wunshot core modules (via Shadcn) or writing custom modules: tables, queries, validations, cascades, archive pairs, ban/activity references, or Effect ops with activity logging. Applies to any host project, regardless of frontend, runtime, or tree layout. Routing, middleware, cookies, and transport wiring belong to your app — this skill covers only the portable DB modules.
---

# Wunshot

Collection of copy-paste database modules (schemas + queries + validations + cascades + ops) on Drizzle ORM + Postgres + Effect.

Paths are shown rooted at your database directory (`db/`); if your tree nests it deeper (e.g. under `src/`), prepend accordingly. Imports shown as `db/…` resolve via your project's path alias (or relative imports). Map script names to your equivalents. The invariants are the module-internal structure (`<domain>/{schemas,queries,validations,cascades,consts}`), the factory/helper contracts, and the op shape — those travel unchanged. Use your project's domain vocabulary in copy and code names.

## Installing

Core modules install via Shadcn from the `wunshot` registry. Install `init` first — every domain module imports `helpers/`:

- `init` → `db/helpers/*` (factories, query/archive helpers, shared consts/types/validators) + `db/index.ts` + drizzle config. `db/index.ts` ships connection resolution for its home runtime — adapt it (your connection string/layer), don't copy it verbatim. Keep its contract: `export class DB`, `dbLayer`, the lazy pool, and the pg `customTypes` passthrough.
- Domain items → `db/models/<domain>/` + `db/ops/<domain>/` (map `db/` to your tree). Installing ops also needs the shared machinery at `db/ops/` root: `ops-error.ts`, `_create-ops-fn.ts`, `_logging.ts`, `_retry.ts`, `_extract-pg-error.ts`, `_current-bans-and-excessive-activities.ts`, `rate-limit-error.ts`. Its import closure reaches further — `_logging.ts` pulls `models/{activities, activities---bans, anons, bans, users}` + `ops/auth/_calc-penalty-time.ts`; `ops-error.ts` pulls `models/activities/{consts,validations}`. Confirm your install source ships that closure; if not, install the named model modules too, or the imports break. `service-bindings.ts` is host Cloudflare code, not portable — keep the `HashingStub` tag, implement its layer for your runtime.
- npm deps: `drizzle-orm` (includes `drizzle-orm/effect-schema`), `effect`, `@effect/sql-pg`, `pg`; dev: `drizzle-kit`, `@types/pg`

## Module anatomy

Each domain lives in `db/models/<domain>/`:

| File | Purpose |
| ---- | ------- |
| `schemas.ts` | Table definitions via factories. Your drizzle-kit `schema` glob must cover `models/**/*(schema|view)s.ts` under your db root — don't name any other file `*schemas.ts` |
| `views.ts` | Postgres views, only if a domain needs one. Same file-level contract as `schemas.ts` (location, naming, imports, comment voice) — but not factory twins |
| `queries.ts` | Prepared queries via helpers |
| `validations.ts` | Statement-input schemas via `drizzle-orm/effect-schema` |
| `cascades.ts` | Archive/delete cascade logic |
| `consts.ts` | Domain constants, when ops or other models need them shared (optional) |

Ops live in `db/ops/<domain>/` — see `references/ops-contract.md`.

Export contract: `tableName`, `activeTable`, `archiveTable` (+ internal `baseCols`, never exported); no barrel files under `models/` or `ops/`; `.ts` extensions on relative imports. First reads: `models/email-verifications/` (FKs, unique indexes, archive mirrors in one small module), `ops/auth/remove-user.ts` (sudo check, pre-check, cascade orchestration in one op).

Import rules (model files stay self-contained):

| File | Imports from |
| ---- | ------------ |
| `schemas.ts` | `drizzle-orm`, `drizzle-orm/pg-core` column builders, `db/helpers/consts.ts` + `tables.ts`, related models' `schemas.ts` |
| `validations.ts` | `drizzle-orm/effect-schema`, `effect`, `RefinementsFor` from `db/helpers/types.ts`, shared refinements from `db/helpers/validators.ts` (+ client-shared shapes from your app's shared validators), `./schemas.ts` |
| `queries.ts` | `drizzle-orm` operators, `createPreparedQuery` / `createQueryFn` from `db/helpers/funcs.ts`, `./schemas.ts`, `./validations.ts`, `./views` (when the model has one) (+ connected models' schemas/validations/consts in `---` dirs) |
| `cascades.ts` | `createArchiveFn` from `db/helpers/funcs.ts`, `./queries.ts`, `./schemas.ts` (+ other models' schemas/cascades for re-pointing) |
| `consts.ts` | — (`UPPER_SNAKE` model constants consumed by ops / other models) |

Cross-domain joins use `---` dirs, alphabetical (`activities---bans`): queries + validations, never tables of their own. A shared enum may live in their `schemas.ts` (e.g. `banScopes`). Never add `relations()` calls — the Drizzle init (`db/index.ts`) carries no schema object, so the relational Query API is unavailable; cross-model reads go in `---` dirs with explicit joins.

Top-level `db/helpers/` serves all models: `tables.ts` (factories), `funcs.ts` (`createPreparedQuery` / `createQueryFn` / `createArchiveFn` / `createArchiveManyFn`), `consts.ts` (shared column config: `TIMESTAMPTZ_CONFIG`, `ARCHIVE_ID_CONFIG`), `types.ts` (`Tx`, `QueryExecutor`, …), `validators.ts` (shared Effect refinements: `IpAddress`, `Argon2Hash`, …).

## Hard rules

- **Never `pgTable` directly.** Use factories in `db/helpers/tables.ts` (all wrap `snakeCase.table`). Linted by `wunshot/no-pgtable-direct`.
- **Effect Schema only.** No zod, no valibot. Bridge via `drizzle-orm/effect-schema`. Linted by `wunshot/no-zod-valibot`.
- **Every table has an active + archive pair.** Deletes move rows, never hard-delete audit data. Append-only event streams use the log factories (`createActiveLogTable`, e.g. `activities`); entities use the regular ones. See `references/tables-archive.md`.
- **Denials never carry `failedCredential`.** Pass email as `meta: {credential}` for audit only. Linted by `wunshot/no-failed-credential-in-denial`.
- **`failureCause` and activity `label` stay free-form text.** Deliberate maintenance decision; do not "fix" into enums.
- **Ops ship here; server functions do not.** Effect ops, no HTTP/cookies. Cookie handling, routing, and op call sites live in the consumer (your app's router/server layer).

## Verifying

New/changed module, in order:

1. `drizzle-kit generate` after any schema edit (twins migrate together), then `drizzle-kit check`.
2. Typecheck (`tsgo --noEmit` / `tsc`).
3. Lint, including the three wunshot rules above. The plugin ships with `init`; register it as an oxlint `jsPlugin` and enable the three rules (the canonical repo's `oxlint.config.ts` shows the shape — adapt to your linter).
4. Execute: run the op (scratch script or studio) — insert a row, archive it, confirm it moved to the archive twin.

Map each to your project's script names; no product tests ship with the modules.

## Philosophy (the wunshot way)

Ship-first, scale-later: everything a new project needs to handle its first users. Easy to start (no structuring decisions left to make), easy to learn (organized, readable, repeatable), easy to eject (copy-paste modules you own — no lock-in).

MORV: Model (migrations, connections, queries) + Operation (business logic, composes queries, formats responses; errors bubble to the op, the op owns handling) + Router (HTTP, cookies, redirects — outside wunshot, owned by the consumer) + View. The op/router split keeps wunshot frontend-agnostic and answers "where does this logic go".

- Repeated code beats early abstractions; optimize for deletion (whichever solution is easier to remove wins).
- Validate then database: malformed input dies before connections open.
- Server-side processing over DB functions (portable, scales horizontally); exception: dates via DB `now()` (timezone/latency consistency).
- Casing: files `kebab-case`; columns `snake_case` SQL / `camelCase` TS; types + validations `PascalCase`; exported consts + env `UPPER_SNAKE`; everything else `camelCase`.
- Comment voice: `/// SECTION ///` banners divide model files (`PRIMITIVES` / `INSERT` / `SELECT` / …). `/** */` is documentation — every export, plus statement-attached invariants a future editor must not undo (it surfaces in IDE hover, which is how installed modules get read). `//` is narration — step labels, line-tied caveats, multi-line rationale, `// SAFETY:` proofs; meaningful only while reading the body. `{@link Symbol}` for cross-refs.

## Branch chooser

Read only what the task needs:

- New domain from scratch, external-service integration, extending core models, entity-vs-event-stream choice: `references/module-walkthrough.md`
- Tables, factories, archive pairs, column gotchas: `references/tables-archive.md`
- Prepared queries, query fns, validations, naming, imports, drizzle gotchas: `references/queries-validations.md`
- Op skeleton, `opsFailure`, labels, retry, hashing order, error contract: `references/ops-contract.md`
- Weight routing, ban scopes, array references: `references/bans.md`

New module: start at `references/module-walkthrough.md`, then tables-archive → queries-validations → ops-contract as needed.

Project Effect conventions take precedence over vendored `effect` / `effect-ts` skills.

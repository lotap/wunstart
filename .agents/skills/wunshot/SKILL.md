---
name: wunshot
description: |
  Portable Drizzle + Postgres + Effect database-module system. Use when finding/installing wunshot core modules (via Shadcn) or writing custom modules: tables, queries, validations, cascades, archive pairs, ban/activity references, auth attempt allowance and denial policy, auth module contract, Effect ops with activity logging, or comment voice for module and op files. Applies to any host project, regardless of frontend, runtime, or tree layout. Routing, middleware, cookies, and transport wiring belong to your app — this skill covers only the portable DB modules.
---

# Wunshot

Collection of copy-paste database modules (schemas + queries + validations + cascades + ops) on Drizzle ORM + Postgres + Effect.

Paths are shown rooted at your database directory (`db/`); if your tree nests it deeper (e.g. under `src/`), prepend accordingly. Imports shown as `db/…` resolve via your project's path alias (or relative imports). Map script names to your equivalents. The invariants are the module-internal structure (`<domain>/{schemas,queries,validations,cascades,consts}`), the factory/helper contracts, and the op shape — those travel unchanged. Use your project's domain vocabulary in copy and code names.

## Branch chooser

Read only what the task needs:

- New domain from scratch, external-service integration, extending core models, entity-vs-event-stream choice: `references/module-walkthrough.md`
- Tables, factories, archive pairs, column gotchas: `references/tables-archive.md`
- Prepared queries, query fns, validations, naming, drizzle gotchas: `references/queries-validations.md`
- Op skeleton, `opsFailure`, labels, retry, hashing order, error contract: `references/ops-contract.md`
- Auth module composition + db-side invariants (eviction, email service, sudo, denial weight): `references/auth.md`
- Weight routing, ban scopes, auth attempt allowance, denial classes, network-keyed IP scope, array references: `references/bans.md`
- Comment voice, policy-map comments, IDE-hover docs: § Philosophy below

New module: start at `references/module-walkthrough.md`, then tables-archive → queries-validations → ops-contract as needed.

## Hard rules

- **Never `pgTable` directly.** Use factories in `db/helpers/table-fns.ts` (all wrap `snakeCase.table`). Linted by `wunshot/no-pgtable-direct`.
- **Effect Schema only.** No zod, no valibot. Bridge via `drizzle-orm/effect-schema`. Linted by `wunshot/no-zod-valibot`.
- **Every table that records a fact has an active + archive pair.** Deletes move rows, never hard-delete audit data. Append-only event streams use the log factories (`createActiveLogTable`, e.g. `activities`); entities use the regular ones. A derived count table — no fact of its own; its presentations are already Activities — is the exception: it calls `snakeCase.table` directly with its own composite key, is swept by age, and keeps no twin (see `references/tables-archive.md`).
- **Never catch `ArchiveCountMismatchError` inside a transaction or cascade body.** It means a concurrent archive won the delete; catching it commits the loser’s duplicate archive insert. Let it roll back and retry (`retryTransientOrArchiveRace`); catch it only outside an archive call that owns its transaction. Linted by `wunshot/no-catch-archive-count-mismatch-in-tx`; see `references/tables-archive.md`.
- **Denials never carry `failedCredential`.** Pass email as `meta: {credential}` for audit only. Linted by `wunshot/no-failed-credential-in-denial`.
- **`failureCause` and activity `label` stay free-form text.** Deliberate maintenance decision; do not “fix” into enums. Control flow uses the tagged error class, never the cause string: a caller that recovers from a specific failure declares an outcome class and catches it by tag or `Schema.is`.
- **Ops ship here; server functions do not.** Effect ops, no HTTP/cookies. Cookie handling, routing, and op call sites live in the consumer (your app's router/server layer).

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

**Auth ops layout:** `strategies/` = authentication/reverification mechanisms; `tokens/` = credential formats, minting, verification, and policies; `sessions/` = session-row lifecycle; `users/` = user-record/account-field ops; `anons/` = anon-row lifecycle. Root holds cross-cutting infrastructure only (`hashing`, `auth-layer`, `consts`, `messages`, user-agent, penalty math). A strategy folder is for a sign-in or reverify mechanism, not every op that touches that field. A token op that touches no entity row stays in `tokens/`; the entity folder owns ops that read, write, or archive the row.

Export contract: `tableName`, `activeTable`, `archiveTable` (+ internal `baseCols`, never exported); no barrel files or forwarding re-exports under `models/` or `ops/` — every symbol has one home, and a move updates its consumers; linted by `wunshot/no-reexport`; `.ts` extensions on relative imports. First reads: `models/email-verifications/` (FKs, unique indexes, archive mirrors in one small module), `ops/auth/users/remove-user.ts` (sudo check, pre-check, cascade orchestration in one op).

Import rules (model files stay self-contained):

| File | Imports from |
| ---- | ------------ |
| `schemas.ts` | `drizzle-orm`, `drizzle-orm/pg-core` column builders, `db/helpers/column-config.ts` + `table-fns.ts`, `./consts.ts`, related models' `schemas.ts` |
| `validations.ts` | `drizzle-orm/effect-schema`, `effect`, `RefinementsFor` from `db/helpers/types.ts`, shared refinements from `db/helpers/validators.ts` (+ client-shared shapes from your app's shared validators), `./schemas.ts` |
| `queries.ts` | `drizzle-orm` operators, `createPreparedQuery` / `createQueryFn` from `db/helpers/query-fns.ts`, `./schemas.ts`, `./validations.ts`, `./views` (when the model has one) (+ connected models' schemas/validations/consts in `---` dirs) |
| `cascades.ts` | `createArchiveFn` from `db/helpers/archive-fns.ts`, `./queries.ts`, `./schemas.ts` (+ other models' schemas/cascades for re-pointing) |
| `consts.ts` | — (`UPPER_SNAKE` model constants consumed by ops / other models) |

Cross-domain joins use `---` dirs, alphabetical (`activities---bans`): queries + validations, never tables of their own. A shared enum may live in their `schemas.ts` (e.g. `banScopes`). Never add `relations()` calls — the Drizzle init (`db/index.ts`) carries no schema object, so the relational Query API is unavailable; cross-model reads go in `---` dirs with explicit joins.

Top-level `db/helpers/` serves all models: `table-fns.ts` (table factories), `query-fns.ts` (`createPreparedQuery` / `createQueryFn` + query SQL fragment helpers), `archive-fns.ts` (`createArchiveFn` / `createArchiveManyFn` + archive errors), `column-config.ts` (shared Drizzle column options: `TIMESTAMPTZ_CONFIG`, `ARCHIVE_ID_CONFIG`), `types.ts` (cross-module type aliases: `Tx`, `QueryExecutor`, …), `validators.ts` (shared Effect refinements: `IpAddress`, `Argon2Hash`, …), `array-fns.ts` (pure array helpers: `appendUniqueBounded`).

**Constants placement:** choose by ownership, not by whether the value is a constant. Shared schema/column options (Drizzle `mode`, `withTimezone`, …) live in the shared column-config module (`db/helpers/column-config.ts`). Domain constants live in the nearest `consts.ts` scope containing every consumer (`models/<domain>/`, `ops/<domain>/`, or a subscope such as `ops/auth/<subscope>/`); a cross-scope constant stays at the domain root. The type follows the consumer: a value JS date math consumes is a number with the unit in the name (`REFRESH_GRACE_SECONDS`, `SESSION_EXPIRATION_DAYS`); a value only SQL consumes is a Postgres interval string named for its role (`AUTH_ATTEMPT_WINDOW`, `PASSCODE_EXPIRATION`), so the unit travels with the value and a threshold derived from it stays unit-agnostic; a value both consume carries both forms (`PENALTY_INTERVAL_INITIAL_QTY` + `PENALTY_INTERVAL_INITIAL`). For example, `SUDO_EXPIRATION_WINDOW` stays at the auth root, the passcode attempt and send limits live in `strategies/email/consts.ts` while the passcode lifespan lives in `models/email-verifications/consts.ts` (a column default reads it, and a model never imports from `ops/`), and token lifetime lives in `tokens/consts.ts`. A value that is a cross-layer contract or carries behavior gets its own named helper (e.g., `ip-sentinels.ts`), never `consts.ts`.

**Messages placement:** a reader-facing message lives in the narrowest messages file that contains every module that emits it. The shared file is `messages.ts` (`db/ops/<domain>/messages.ts`; `isomorphic/<domain>-messages.ts` for client-imported copy); a scope-internal file is `_messages.ts` (`db/ops/auth/strategies/email/_messages.ts`, `db/ops/auth/strategies/password/_messages.ts`, `db/ops/auth/tokens/_messages.ts`, `middleware/_messages.ts`). `_` is a boundary directive, not a statement about current importers: only same-directory modules may import it. If a consumer outside the directory needs a message, promote that message to the nearest shared `messages.ts` instead of reaching in. Copy emitted across subfolders or by a domain-root module lives in the root `messages.ts`. Promote to the common parent when a second scope needs the message; the first message in a scope creates its file. Audit causes, parameter guards, internal state-error text, and log text are diagnostics and stay at the branch. Strings the client imports for recognition or display live in the host’s `isomorphic/<domain>-messages.ts`; no cross-domain or top-level `messages.ts`.

**Helpers placement and naming:** name a helper module by what it exports, not by the domain it touches. Callables and factories → `<domain>-fns.ts`: query/prepared-query factories and query SQL fragments → `query-fns.ts`; archive factories, archive errors, and cascade machinery → `archive-fns.ts`; table factories → `table-fns.ts`; pure array utilities → `array-fns.ts`. Values and schemas keep the plain noun: column options → `column-config.ts`; schema refinements → `validators.ts`. Type aliases only → `types.ts`. A cross-layer contract gets its own named module (e.g., `ip-sentinels.ts`). Do not create a `funcs.ts` or other catch-all: if a new helper does not fit a named module, name the module after it.

## Installing

In this repo the modules already live under `src/db/` — the install story below applies to a new host project. Core modules install via Shadcn from the `wunshot` registry. Install `init` first — every domain module imports `helpers/`:

- `init` → `db/helpers/*` (factories, query/archive helpers, shared column config/types/validators) + `db/index.ts` + drizzle config. `db/index.ts` ships connection resolution for its home runtime — adapt it (your connection string/layer), don't copy it verbatim. Keep its contract: `export class DB`, `dbLayer`, the lazy pool, and the pg `customTypes` passthrough.
- Domain items → `db/models/<domain>/` + `db/ops/<domain>/` (map `db/` to your tree). No registration step: the drizzle-kit glob auto-discovers `*schemas.ts`, and twins migrate together. Installing ops also needs the shared machinery at `db/ops/` root: `ops-error.ts`, `_create-ops-fn.ts`, `_logging.ts`, `_retry.ts`, `_extract-pg-error.ts`, `_current-bans-and-excessive-activities.ts`, `rate-limit-error.ts`. Its import closure reaches further — `_logging.ts` pulls `models/{activities, activities---bans, anons, bans, users}` + `ops/auth/_calc-penalty-time.ts`; `ops-error.ts` pulls `models/activities/{consts,validations}`. The closure is whatever the installed ops import, not the names in this bullet: typecheck after installing and add every missing module. `service-bindings.ts` is host Cloudflare code, not portable — keep the `HashingStub` tag, implement its layer for your runtime. Auth ops also import host-side modules — for example `#/isomorphic/auth-messages.ts` (the client-matched session copy), `#/isomorphic/validations/auth.ts`, and `#/email/service.ts` with its templates; keep those modules or repoint the imports.
- npm deps: `drizzle-orm` (includes `drizzle-orm/effect-schema`), `effect`, `@effect/sql-pg`, `pg`; dev: `drizzle-kit`, `@types/pg`

## Verifying

New/changed module, in order:

1. `drizzle-kit generate` after any schema edit (twins migrate together), then `drizzle-kit check`.
2. Typecheck (`tsgo --noEmit` / `tsc`).
3. Lint, including the three wunshot rules above. The plugin ships with `init`; register it as an oxlint `jsPlugin` and enable the three rules (adapt the config shape to your linter).
4. Execute: run the op (scratch script or studio) — insert a row, archive it, confirm it moved to the archive twin.

Map each to your project's script names; no product tests ship with the modules.

## Philosophy (the wunshot way)

Ship-first, scale-later: everything a new project needs to handle its first users. Easy to start (no structuring decisions left to make), easy to learn (organized, readable, repeatable), easy to eject (copy-paste modules you own — no lock-in).

MORV: Model (migrations, connections, queries) + Operation (business logic, composes queries, formats responses; errors bubble to the op, the op owns handling) + Router (HTTP, cookies, redirects — outside wunshot, owned by the consumer) + View. The op/router split keeps wunshot frontend-agnostic and answers "where does this logic go".

- Repeated code beats early abstractions; optimize for deletion (whichever solution is easier to remove wins).
- Validate then database: malformed input dies before connections open.
- Server-side processing over DB functions (portable, scales horizontally); exception: dates via DB `now()` (timezone/latency consistency).
- Casing: files `kebab-case`; columns `snake_case` SQL / `camelCase` TS; types + validations `PascalCase`; exported consts + env `UPPER_SNAKE`; everything else `camelCase`.
- Comment voice: `/// SECTION ///` banners divide model files (`PRIMITIVES` / `INSERT` / `SELECT` / …). `/** */` documents a declaration or a statement-attached invariant — IDE hover where VS Code attaches it; a concise description is useful even when it restates the signature, so keep it accurate. `//` for local explanation or `// SAFETY:` proof; verbosity is fine, but don’t restate a policy map, weight, or closed set that can drift — point to the owner. The exception is a point-of-use explanation of an arbitrary constant’s non-obvious consequence; keep it with the constant and update it with the owner. `{@link Symbol}` for cross-refs.
Project Effect conventions take precedence over vendored `effect` / `effect-ts` skills.

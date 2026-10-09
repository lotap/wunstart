# Wunstart

Stack: TanStack Start (React) + TanStack Router + TanStack Query + Drizzle/Effect + Postgres + Cloudflare Workers

## Setup

- Package manager: **bun** (`bun.lock`). Use `bun install`.
- Postgres via Docker: `docker compose up -d`. Password `mypassword` (see `compose.yaml`).
- `.env.local` must define `DATABASE_URL`. The `db:*` scripts load it via `dotenv -e .env.local`. `.env.development` is loaded by the Cloudflare vite plugin for the dev server and also holds the JWT secrets + `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.
- No manual setup step for deps or wasm: `bun run dev` self-provisions both via `predev` (`bun install`, ~seconds from the warm cache, then `build:wasm`, an instant cache hit when Rust sources are unchanged). Requires Rust + the `wasm32-unknown-unknown` rustup target for the rare actual recompile. `build:wasm` (`tools/build-wasm.sh`) shares its cargo target dir (`../.shared-cargo-target`) and a content-hashed wasm cache (`../.shared-wasm-cache`) across sibling worktrees.
- `prepare` script runs `effect-tsgo patch` automatically on install.

## Commands (use `bun --bun` prefix when possible)

The `--bun` flag forces Bun's native runtime; without it, scripts may fall back to Node. That's necessary in some cases, such as running the dev server.

| Command                                                      | What                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `bun run dev`                                                | Dev server on port 3000 - NEVER PREFIX WITH `bun --bun`                                              |
| `bun --bun run build`                                        | `build:wasm` (Rust→Wasm) then `vite build`                                                           |
| `bun --bun run test`                                         | Vitest single run (no separate config; uses `vite.config.ts`)                                        |
| `bun --bun run deploy`                                       | Build + `wrangler deploy`                                                                            |
| `bun --bun run fmt` / `fmt:check`                            | oxfmt `src/` (write / check-only)                                                                    |
| `bun --bun run lint` / `lint:check`                          | oxlint `src/` (warnings ok / `--deny-warnings`)                                                      |
| `bun --bun run generate-routes`                              | Regenerate `src/routeTree.gen.ts`                                                                    |
| `bun --bun run db:generate`                                  | Drizzle schema → SQL migration                                                                       |
| `bun --bun run db:check`                                     | Drizzle-kit migration check                                                                          |
| `bun --bun run db:migrate`                                   | Apply pending migrations                                                                             |
| `bun --bun run db:push`                                      | Push schema directly (dev)                                                                           |
| `bun --bun run db:pull`                                      | Introspect existing DB into schema                                                                   |
| `bun --bun run db:seed`                                      | Run `src/db/seed.ts`                                                                                 |
| `bun --bun run db:studio`                                    | Drizzle Studio (GUI)                                                                                 |
| `bun --bun run cf-typegen`                                   | `wrangler types` → `worker-configuration.d.ts` (regenerate after changing `wrangler.jsonc` bindings) |
| `bun --bun run build:preview` / `preview`                    | Dev-mode build / serve the built app locally                                                         |
| `bun --bun run dev:email`                                    | React Email template dev server on port 3001                                                         |
| `bun --bun run archive-old-activities`                       | Manually run the activity-retention job the daily cron executes (needs `.env.local`)                 |
| `bun --bun run db:export` / `db:up` / `db:mcp` / `db:skills` | Additional drizzle-kit passthroughs                                                                  |
| `bunx --bun shadcn@latest add <cmp>`                         | Install shadcn components                                                                            |

Run a single test file: `bun --bun run test -- src/path/to/file`. No `typecheck` script. Use `bunx tsgo --noEmit` (`@typescript/native-preview`).

## Project anatomy

- **`CONTEXT.md`**: Starter-kit glossary. Replace it with your product's domain language; read before writing feature code.
- **`docs/adr/`**: 10 ADRs (0001-0010). Read before architectural changes. Covers auth strategy (0001), anon identity (0002), credential/ban weight routing (0003), ban activity references (0004), hashing offloaded to a Durable Object (0005), active/archive table pairs (0006), email verification and transport (0007), lazy-loaded request-bound modules in middleware (0008), email delivery side-effect semantics (0009), no user-facing single-session revocation (0010).
- **`src/server.ts`**: Cloudflare Workers entry (`wrangler.jsonc` `main`). Re-exports the `AuthHasher` Durable Object and the TanStack Start fetch handler, plus the `scheduled` handler for the daily cron trigger (`30 6 * * *` UTC) that archives activities older than 30 days.
- **`src/start.ts`**: `createStart` app factory; wires request middleware (CSRF, error handling) and function middleware (rate limit @150 req/min, anon-token issuing).
- **`src/router.tsx`**: Router factory wired to TanStack Query.
- **`src/routes/`**: file-based routing (TanStack Router). Add a file, get a route. Pathless `_auth-*` layouts group pages by auth behavior, not URL — file placement IS the protection, so treat moves across these folders as security-relevant in review: `_auth-protected` (requires sign-in, anons redirect to `/sign-in` with return location; e.g. settings), `_auth-gateway` (sign-in/up flows, authed users bounce to `/`), `_auth-dynamic` (renders for anon and authed, adapts to auth state; e.g. home), `_auth-anon` (public pages, no auth behavior; e.g. landing-page). Auth is verified once in `__root.tsx` `beforeLoad`; layouts read `context.auth` — do not re-call `handleVerifyAuth` in child routes.
- **`src/routeTree.gen.ts`**: auto-generated by `generate-routes`. Read-only; do not edit.
- **`src/server-fns/`**: TanStack Start server functions (`createServerFn`).
- **`src/middleware/`**: request/function middleware: auth verification, anon verify/issue, rate limiting, error handling, request-info extraction (`get-request-info.ts`: forwarded IP, user-agent, visitor geolocation from Cloudflare headers; `country`/`city`/`region` where city/region are null when the headers are absent). The auth/anon contexts are status-discriminated as `'authenticated'` or `'verified'`, with `null` for no identity. Typed invalid-token failures fall through to anonymous. Infrastructure failures (db/config/defects) produce `{status: 'degraded'}` (see `src/middleware/_degraded-auth.ts`), which the global `rejectDegradedAuth` middleware rejects with a 503-safe message before server fns run. Cookies are only cleared for definitively-invalid tokens, never because validation could not run. `requireAuth`/`requireAnon`/`requireAnonRegistered` are standalone middlewares that read the already-verified global context (no re-verification, no degraded handling).
- **`src/durable-objects/auth-hasher.ts`**: `AuthHasher` Durable Object; loads the Wasm module to hash/verify passwords (ADR 0005). Bound as `AUTH_HASHER` in `wrangler.jsonc`.
- **`src/db/models/<domain>/`**: Drizzle schemas per domain (see DB conventions). Dir names use `---` for cross-domain joins (e.g. `activities---bans`, `sessions---users`).
- **`src/db/helpers/`**: table factories (`tables.ts`), query/archive helpers (`funcs.ts`), validators, shared types/consts.
- **`src/db/ops/`**: Effect-based ops with automatic activity logging (see Ops below).
- **`src/db/index.ts`**: Effect-wrapped Drizzle client. Exports `DB` (service tag) and `dbLayer`. Resolves the connection string from `DATABASE_URL`, falling back to `env.HYPERDRIVE.connectionString` via a lazy `cloudflare:workers` import, so DB code **only runs with valid credentials inside the Cloudflare runtime** (the dev server provides it via the vite plugin). Migrations bypass this; `drizzle-kit` connects directly via `DATABASE_URL`.
- **`src/integrations/tanstack-query/`**: Query client setup.
- **`src/lib/utils.ts`**: `cn()` helper (clsx + tailwind-merge).
- **`src/components/ui/`**: shadcn components.
- **`src/styles.css`**: Tailwind v4 theme tokens via CSS vars (e.g. `--sea-ink`) + `@theme inline`. Not a Tailwind config file.

## DB conventions

### Model structure

Each domain lives in `src/db/models/<domain>/` with these files:

| File             | Purpose                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `schemas.ts`     | Table definitions using table factories (see below)                                       |
| `queries.ts`     | Prepared queries using `createPreparedQuery` helper                                       |
| `validations.ts` | Effect Schema via `drizzle-orm/effect-schema` (`createInsertSchema`/`createSelectSchema`) |
| `cascades.ts`    | Cascade logic for archive/delete operations                                               |
| `consts.ts`      | Domain-specific constants (optional)                                                      |
| `views.ts`       | Drizzle views using `snakeCase.view()` (optional)                                         |

Drizzle config glob (`drizzle.config.ts`): `src/db/models/**/*(schema|view)s.ts`. Only files under `models/` ending in `schemas.ts`/`views.ts` are discovered.

### Table factories

**Never use `pgTable` directly.** Use helpers from `src/db/helpers/tables.ts` (all wrap `snakeCase.table`):

- `createActiveTable(name, cols)`: adds `id` (uuid), `createdAt`, `updatedAt` with auto-update
- `createArchiveTable(name, cols)`: adds `id`, `createdAt`, `updatedAt`, `archiveId` (bigint identity), `archivedAt`
- `createActiveLogTable(name, cols)`: adds `id` (uuid), `timestamp`
- `createArchiveLogTable(name, cols)`: adds `id`, `timestamp`, `archiveId`, `archivedAt`

Every table has an **active + archive pair** (ADR 0006). Use `createArchiveFn` from `src/db/helpers/funcs.ts` for soft-delete (moves row to archive table in a transaction with cascades).

### Query pattern

Queries use `createPreparedQuery` or `createQueryFn` from `src/db/helpers/funcs.ts`. Both accept an Effect Schema for input validation and auto-handle parsing + transaction passthrough.

### Ops

`src/db/ops/` contains Effect-based business operations (typed errors + composable layers; expect an Effect learning curve), grouped in `auth/` (incl. `auth/email/`) and `system/`.

- **`createOpsFn`** (`src/db/ops/_create-ops-fn.ts`): wraps an op `fn` with automatic activity logging. `logSuccessfulActivity` on success (using `params.anonId`/`userId` + `label`), `logFailedActivity` on failure (typed failures and defects; interruptions are preserved untouched), and it sanitizes the error channel: errors conforming to the ops-error contract (`OpsErrorSchema`/`isOpsError` in `src/db/ops/ops-error.ts`, a valid `activity` insert payload + client-safe `message`) pass through untouched; unknown errors are wrapped into a generic `OpsError` (`failureCause: 'INTERNAL_ERROR'`) so internals never leak to users. `ipAddress` is required in params; `logOnSuccess`/`logOnFailure` can be overridden per call. Activity rows and ban updates are written in one retried transaction; a failed write emits a structured error log but never changes the op's outcome (committed mutations are never misreported as failed, per ADR 0009). Defects log with weight 0 so server faults never feed ban thresholds. `createSystemOpsFn` is the system-op variant, defaulting `ipAddress` to `0.0.0.0`.
- **`runOp`** (`src/middleware/_run-op.server.ts`): how ops are executed from server fns & middleware. Takes `{op, data, layers}` and runs `Effect.provide(layers)` + `Effect.runPromise`, unwrapping the Effect into a plain value. Forwards `RateLimitError` failures (the framework's ban/rate-limit rejection, built by `rateLimitFailure` in `src/db/ops/rate-limit-error.ts`) to the middleware rate limiter (429); any other failure rejects the promise, so callers classify errors themselves. The auth convention: `verifyAuth`/`verifyAnon` (`src/middleware/`) wrap their identity-op calls in try/catch and decide the request's identity state inline. `AuthTokenError` means definitively invalid (anonymous, clear cookies where applicable). `RateLimitError` keeps cookies and falls through to anonymous. Anything else (including defects) becomes the explicit `{status: 'degraded'}` context state (`src/middleware/_degraded-auth.ts`), which the global `rejectDegradedAuth` middleware (`start.ts` functionMiddleware, after `verifyAnon`) rejects with a 503-safe message before any server fn runs, so server fns never see the degraded state. `KnownServerError` (429s) is rethrown untouched. Wrapped in `createServerOnlyFn` so it never runs client-side. Error conventions (`src/db/ops/ops-error.ts`): `OpsError` is the generic ops error for anticipated failures; `RateLimitError` is the framework rate-limit rejection; ops declare their own `TaggedErrorClass` (same `{activity, message}` shape, e.g. `AuthTokenError`) only when a classifier must react to the failure by type; internal/infra errors stay raw and get wrapped automatically. New ops modules opt into pass-through, activity logging, and 422 sanitization by conforming to the ops-error contract. Generic files never change.
- **Layers are passed per run, not baked into ops.** Callers supply exactly what the op needs (`runOp`'s generics fail to compile if `layers` don't cover the op's requirements), and `dbLayer`'s dependency graph is built/torn down inside the effect's scope:
  - `dbLayer` (`src/db/index.ts`): provides the `DB` service (Drizzle over `@effect/sql-pg`). Resolves the connection string from `DATABASE_URL`, falling back to the Hyperdrive binding via a lazy `cloudflare:workers` import; the pg pool is lazy (building the layer never connects), so JWT-only paths can inject it without touching Postgres.
  - `authLayer` (`src/db/ops/auth/_auth-layer.ts`): provides the JWT secret Config services (`AccessTokenSecretsConfig`, `AnonTokenSecretsConfig`, `RefreshTokenSecretsConfig`, `GraceTokenSecretsConfig`), parsed from `ACCESS_TOKEN_SECRETS`/`ANON_TOKEN_SECRETS`/`REFRESH_TOKEN_SECRETS`/`REFRESH_GRACE_TOKEN_SECRETS` (`id:secret` pairs). `REFRESH_GRACE_TOKEN_SECRETS` is a dedicated set for the refresh grace-token JWE so a combined leak of the signing secrets and the database cannot recover the plaintext successor nonce.
  - `emailLayer` (`src/email/layer.ts`): dev vs prod email transport.

```ts
const result = await runOp({
	op: signOut,
	data: {token: refreshToken, ipAddress},
	layers: [authLayer, dbLayer],
})
```

Ops that need the `AuthHasher` Durable Object provide `HashingStub.layer(name)` from `src/db/ops/service-bindings.ts` themselves.

## Conventions

- **Path aliases**: `#/...` and `@/...` both map to `./src/...` in `tsconfig.json`; only `#/...` is also a runtime alias (`package.json` `imports`), so prefer it.
- **Validation**: Effect Schema (not zod, not valibot). `drizzle-orm/effect-schema` bridges Drizzle tables to Effect Schema (`createInsertSchema`/`createSelectSchema`). Check imports before adding validation.
- **Styling**: Tailwind v4 (CSS-first config). Use `@theme inline` for tokens. Shadcn components use `cn()`.
- **UI libs**: shadcn/ui Base UI flavor, `base-nova` style (see `components.json`); icons from `lucide-react`. Components use `cn()`.
- **Auth**: Self-rolled (DB sessions + JWT hybrid, see ADR 0001). Password hashing is offloaded to the `AuthHasher` Durable Object (ADR 0005).
- **Server functions**: Act on the cookie identity — middleware (`requireAuth`/`requireAnonRegistered`) unwraps db ids server-side, so the client never supplies or receives db ids. A fn that accepts an id param is the exception and must say so in its name (e.g. `...ById`) and validate authorization for it.
- **Readability**: prefer flat over nested — early returns/guard clauses over nested ternaries, small named helpers over config tables or clever dispatch. Model the states first, then pick the dullest construct that fits.
- **Future cost**: prefer a small structural change now that prevents an expensive retrofit later — policy by construction over per-call-site discipline, even when the immediate diff is slightly larger. Cheap now beats expensive later.
- **TypeScript**: v6 with `@typescript/native-preview` (`tsgo`). `verbatimModuleSyntax: true` (use `import type` for types). `noUnusedLocals` and `noUnusedParameters` are enabled, so unused bindings fail the build.
- **Format/lint**: oxfmt + oxlint (not prettier, not eslint). Run both before commit.
- **Formatting style** (from `.oxfmtrc.json`): **no semicolons**, **tabs** for indentation, **single quotes**, **no bracket spacing** (`{key}` not `{ key }`). Imports are auto-sorted by oxfmt, so don't manually order them.
- **Effect services** (per `.agents/skills/effect/`): service impls return `Service.of({...})`; non-trivial service methods use `Effect.fn('Service.method', ...)` for tracing; typed errors via `Schema.TaggedErrorClass`; env config validated at the `Config` boundary with `Config.schema(Schema.Literals([...]), 'ENV')` (plural, array form, not variadic `Literal`). No keyof casts, no string `Effect.fail`. `Config.withDefault` only for missing-data defaults (it's curried and unions `A2 | A`, so annotate the default's type). `Config.option` for optional keys, `Config.redacted` for credentials.
- **shadcn components** `src/components/ui/**` is generated shadcn output (see `components.json`). Editing those files directly is a last resort: it diverges from the registry and makes future `shadcn add`/updates painful. Prefer customizing from the caller with Tailwind classnames (they merge through `cn`); patch the ui file only when the change is impossible from outside (new export, variant, or behavior), and keep it minimal.

## Dev server gotchas

- **Kill the dev server by specific PID** to avoid nuking unrelated processes on port 3000:
  `lsof -ti :3000 -sTCP:LISTEN | head -1 | xargs kill`. The `-sTCP:LISTEN` flag restricts to the listening process (your dev server) so browser connections aren't included.
- Route additions require `bun --bun run generate-routes` (or restart the dev server, which regenerates automatically).
- TanStack Router + React Query + React devtools are wired in `__root.tsx`, active in dev automatically.

# Wunstart

Stack: TanStack Start (React) + Router + Query + Drizzle/Effect + Postgres + Cloudflare Workers. Bare repo + worktrees: work inside a worktree (`trunk/`, `agentic-cleanup/`, `placeholder-content/`), never repo root.

## Skills (read before coding)

- `.agents/skills/wunshot/` — tables, queries, validations, ops, bans. Portable DB-module rules; canonical here, backfilled to the `wunshot` registry.
- `.agents/skills/wunstart/` — server fns, `_auth-*` routes, middleware, cookies, DO hashing, email, Workers runtime.
- `CONTEXT.md` — product glossary. Replace with your domain language; use its vocabulary in copy and code names (Anon not Guest, User not Account).
- Vendored `.agents/skills/` (effect, shadcn, …) are fallback only; project skills above take precedence. Do NOT trust `tanstack-start` skill (documents `.handler`/zod/Nitro; code uses `.server`/Effect Schema/`@cloudflare/vite-plugin`).

## Setup

- `bun install` (also enables repo-local git hooks via `prepare`; `bun run setup:hooks` re-runs manually). `bun run dev` (:3000, NEVER `bun --bun` for dev).
- Wasm kernel (`src/durable-objects/argon2-do-hasher.wasm`) is committed — dev/build/deploy never need Rust. Only `bun --bun run build:wasm` needs Rust + `wasm32-unknown-unknown`, and only after editing `crates/argon2-do-hasher`; commit the rebuilt wasm with the source change (pre-commit hook enforces this).
- Postgres: `docker compose up -d` (`mypassword`). `.env.local` = `DATABASE_URL` (for `db:*` via `dotenv -e`); `.env.development` = dev server + JWT `*_SECRETS` + Hyperdrive local string (via CF vite plugin).
- No typecheck script: `bunx tsgo --noEmit` (`noUnusedLocals`/`noUnusedParameters` fail the build — no dead bindings). Tests: `bun --bun run test` is BROKEN pre-existing (Cloudflare vite plugin rejects vitest's `ssr.resolve.external` at startup, same on trunk); linter rule tests run via `bun run test:lint` (NEVER `bun --bun` — oxlint RuleTester needs node), zero product tests — verify with lint + tsgo + manual dev server.
- Scratch: `.tmp/` only (never `/tmp`; `bun run clean:tmp` wipes). Chrome-devtools `filePath` resolves from workspace root → use `<worktree>/.tmp/<file>`.

## Commands (`bun --bun` prefix except `dev` and `test:lint`)

`dev` (:3000) · `build` (vite; committed wasm included) · `build:wasm` (rebuild kernel after Rust edits; commit result) · `setup:hooks` (re-point git at `tools/hooks/`) · `test:lint` (linter rule tests — never prefix with `--bun`) · `deploy` · `fmt`/`fmt:check` (oxfmt `src/`) · `lint`/`lint:check` (`--deny-warnings`) · `generate-routes` (after adding routes) · `db:generate`/`db:check`/`db:migrate`/`db:push`/`db:pull`/`db:studio` (+ `db:export`/`db:up`/`db:mcp`/`db:skills` passthroughs) · `cf-typegen` (after `wrangler.jsonc` binding change) · `dev:email` (:3001) · `build:preview`/`preview` (dev-mode build/serve) · `archive-old-activities` (needs `.env.local`) · `bunx --bun shadcn@latest add <cmp>` (install shadcn components). Single linter test: `bun run test:lint -- <path>`. NOTE: `db:seed` script is broken (`src/db/seed.ts` does not exist).

## Hard rules

- Never `pgTable` — use `createActive/Archive/LogTable` factories. `failureCause`/activity `label` stay free-form text.
- `_`-prefix = internal (`_auth-*` layouts, `_x` ops/helpers); `no-underscore-dangle` off by design. Distinct: `-components/` (dash) = TanStack route-tree exclusion, not internal-marking. `_auth-*` moves are security-relevant in review.
- Never edit `routeTree.gen.ts` or `src/components/ui/**` (generated; override via caller `cn()`).
- Import via `#/...` only — `@/...` is a tsconfig alias but NOT a runtime alias, so `@/` imports break at runtime. Always include `.ts`/`.tsx` extension on relative imports. Blocks grouped packages → `#/` → relative with blank lines; oxfmt sorts within blocks (+ Tailwind in `cn()`).
- Readability: flat over nested (guard clauses over ternaries, small named helpers over clever dispatch). Future cost: small structural change now beats expensive retrofit later (policy by construction over per-site discipline).
- Every `as` needs preceding `// SAFETY:` comment. House voice, not linted: `/** */` comments + `{@link}` cross-refs, curly apostrophes (don't) + sentence-case in user copy.
- Kill dev by PID only: `lsof -ti :3000 -sTCP:LISTEN | head -1 | xargs kill`.

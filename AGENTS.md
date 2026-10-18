# Wunstart

Stack: TanStack Start (React) + Router + Query + Drizzle/Effect + Postgres + Cloudflare Workers. Bare repo + worktrees: work inside a worktree, never repo root.

## Skills (read before coding)

- `.agents/skills/wunshot/` — tables, queries, validations, cascades/archive pairs, ops contract, auth module contract, bans (portable DB-module rules).
- `.agents/skills/wunstart/` — server fns, `_auth-*` routes + adding-a-page recipe, middleware, cookies, forms (TanStack Form), shadcn/Base UI composition, styling/theme, contexts/hooks, isomorphic validation, DO hashing, email, Workers runtime, visual contract + page-craft process (`references/design/`).
- `CONTEXT.md` — product glossary. Replace with your domain language; use its vocabulary in copy and code names (Anon not Guest, User not Account).
- Dictation artifacts: "one start" = `wunstart`, "one shot" = `wunshot`.
- Vendored `.agents/skills/` (effect, shadcn, web-perf, …) are fallback, except where a project skill recommends one; project skills take precedence. Do NOT trust the `tanstack-start` skill — the wunstart skill documents why.

## Setup

- `bun install` (also enables repo-local git hooks via `prepare`; `bun run setup:hooks` re-runs manually). `bun run dev` (:3000, NEVER `bun --bun` for dev) self-provisions deps via `predev` — fresh worktrees need no manual install.
- Wasm kernel (`src/durable-objects/argon2-do-hasher.wasm`) is committed — dev/build/deploy never need Rust; rebuild only after editing `crates/` (see Commands below; pre-commit hook blocks `crates/` edits without a staged wasm; params, sharding, rejected alternatives: wunstart skill `references/hashing.md`).
- Postgres: `docker compose up -d` (`mypassword`). `.env.development` (committed) = `DATABASE_URL` + JWT `*_SECRETS` + Hyperdrive local string + `VITE_COOKIE_DOMAIN` — read by the dev server (CF vite plugin) and by the drizzle-kit `db:*` scripts (via `dotenv -e`). `.env.local` (gitignored via `*.local`) is read only by `archive-old-activities` and `db:seed`.
- No typecheck script: `bunx tsgo --noEmit` (`noUnusedLocals`/`noUnusedParameters` fail the build — no dead bindings). Tests: `bun --bun run test` is BROKEN pre-existing (Cloudflare vite plugin rejects vitest's `ssr.resolve.external` at startup, same on trunk); linter rule tests run via `bun run test:lint` (NEVER `bun --bun` — oxlint RuleTester needs node), zero product tests — verify with lint + tsgo + manual dev server.
- Scratch: `.tmp/` only (never `/tmp`; `bun run clean:tmp` wipes). Chrome-devtools `filePath` resolves from workspace root → use `<worktree>/.tmp/<file>`.

## Commands (`bun --bun` prefix except `dev` and `test:lint`)

`dev` (:3000) · `build` (vite; committed wasm included) · `build:wasm` (rebuild kernel after Rust edits; commit result) · `setup:hooks` (re-point git at `tools/hooks/`) · `test:lint` (linter rule tests — never prefix with `--bun`) · `deploy` · `fmt`/`fmt:check` (oxfmt `src/`) · `lint`/`lint:check` (`--deny-warnings`) · `generate-routes` (after adding routes) · `db:generate`/`db:check`/`db:migrate`/`db:push`/`db:pull`/`db:studio` (+ `db:export`/`db:up`/`db:mcp`/`db:skills` passthroughs) · `cf-typegen` (after `wrangler.jsonc` binding change) · `dev:email` (:3001) · `build:preview`/`preview` (dev-mode build/serve) · `archive-old-activities` (needs `.env.local`) · `bunx --bun shadcn@latest add <cmp>` (install shadcn components). Single linter test: `bun run test:lint -- <path>`. NOTE: `db:seed` script is broken (`src/db/seed.ts` does not exist).

## Hard rules

- DB conventions (factories, free-form labels, Effect Schema only) live in the wunshot skill — backed by its lint rules where those are lintable.
- `no-underscore-dangle` off by design (`_`-prefix marks internal). Route/file placement rules (`_auth-*`, `-components/`) live in the wunstart skill's `references/app.md`.
- Generated files (`routeTree.gen.ts`, `src/components/ui/**`): don't hand-edit; override from the caller via `cn()` (narrow patch exception in the wunstart skill's `references/app.md`).
- Import via `#/...` — the only alias also registered at runtime (`package.json` `imports`); `@/...` is a tsconfig alias that Vite (`tsconfigPaths`) and Bun happen to resolve, so don't add new ones (`#/` survives any executor and registry porting). Always include `.ts`/`.tsx` extension on relative imports. Blocks grouped packages → `#/` → relative with blank lines; oxfmt sorts within blocks (Tailwind/`cn()` sorting: see wunstart `references/app.md`).
- Readability: flat over nested (guard clauses over ternaries, small named helpers over clever dispatch). Future cost: small structural change now beats expensive retrofit later (policy by construction over per-site discipline).
- `// SAFETY:` proof comment above every `as` — lint-enforced (`anti-slop/require-safety-comment-for-type-assertion`).
- Formatting (`.oxfmtrc.json`): no semicolons · tabs · single quotes · no bracket spacing (`{key}`). oxfmt auto-sorts imports and Tailwind — don't hand-order. `fmt` covers `src/` only; hand-write `tools/` to the same style.
- House voice (not linted): `/** */` doc comments + `{@link}` cross-refs; sentence case + curly apostrophes (`’`, not `'`) in user copy. Model/ops comment voice: wunshot skill.
- Lint plugins (`oxlint.config.ts`): `wunstart` (app/Workers seams) · `wunshot` (portable DB invariants) · `anti-slop` (+ `anti-slop-effect`, type-assertion and slop patterns). Rules are the backstop — the skills are the spec. Before commit: `fmt`, then `lint:check` + `bunx tsgo --noEmit` clean.
- Commit only on explicit request.
- Kill dev by PID only: `lsof -ti :3000 -sTCP:LISTEN | head -1 | xargs kill`.

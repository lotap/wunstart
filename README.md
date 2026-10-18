# Wunstart

A full-stack TypeScript starter kit for building and deploying your own service: a self-rolled auth core (sessions + JWT, anon identity, email verification), weight-based ban/rate-limiting, Effect-wrapped Drizzle on Postgres, and Cloudflare Workers deployment. Clone it, rename it, and build your product on top.

## Stack

- **Framework**: [TanStack Start](https://tanstack.com/start/latest) (React) + [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query)
- **Database**: PostgreSQL via Drizzle ORM, wrapped with Effect
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Validation**: Effect Schema (via `drizzle-orm/effect-schema`)
- **Deployment**: Cloudflare Workers
- **Package manager**: Bun

## Getting started

```bash
# Install dependencies (also enables the repo's git hooks, repo-local config only)
bun install

# Start postgres (Docker)
docker compose up -d

# .env.development is committed and pre-wired for the local Docker stack
# (DATABASE_URL, JWT *_SECRETS, Hyperdrive local string) — the dev server and
# the drizzle-kit db:* scripts read it; edit it as needed. (.env.local is read
# only by `archive-old-activities` and `db:seed`.)

# Migrate the database
bun --bun run db:migrate

# Start dev server on port 3000 (never prefix `dev` with --bun)
bun run dev
```

## Commands

| Command                     | What                           |
| --------------------------- | ------------------------------ |
| `bun run dev`               | Dev server on port 3000        |
| `bun --bun run build`       | Production build               |
| `bun --bun run db:generate` | Generate migration from schema |
| `bun --bun run db:migrate`  | Apply pending migrations       |
| `bun --bun run db:push`     | Push schema directly (dev)     |
| `bun --bun run db:studio`   | Drizzle Studio (GUI)           |
| `bun --bun run lint`        | oxlint                         |
| `bun --bun run fmt`         | oxfmt                          |

## Project structure

```
src/
├── server.ts               # Cloudflare Workers entry point
├── start.ts                # createStart app factory + middleware
├── router.tsx              # Router factory (wired to TanStack Query)
├── routeTree.gen.ts        # Generated routes (don't hand-edit)
├── styles.css              # Tailwind v4 theme tokens
├── routes/                 # File-based routing (TanStack Router)
├── server-fns/             # TanStack Start server functions
├── middleware/              # Request/function middleware (auth, rate-limit, CSRF)
├── scripts/                # One-off scripts (archive-old-activities)
├── db/
│   ├── index.ts            # Effect-wrapped Drizzle client
│   ├── models/             # Per-domain schemas, queries, validations, cascades
│   ├── ops/                # Effect-based business operations (auto activity logging)
│   ├── helpers/            # Table factories, query/archive helpers, validators
│   └── migrations/         # Drizzle-generated SQL migrations
├── durable-objects/
│   └── auth-hasher.ts      # AuthHasher Durable Object (password hashing via Wasm)
├── components/
│   ├── ui/                 # shadcn components
│   ├── auth/               # Sign-in, sign-up, password-change forms
│   ├── form-fields/        # Email, password, passcode field components
│   ├── header.tsx
│   ├── footer.tsx
│   ├── dashboard.tsx
│   └── theme-toggle.tsx
├── email/
│   ├── service.ts          # EmailService Effect service
│   ├── layer.ts            # Dev/prod email layer wiring
│   ├── transports/         # Mailpit (dev) + send_email (prod) + Brevo (example fallback)
│   └── templates/          # React Email templates
├── isomorphic/             # Shared validation schemas (server + client)
├── integrations/
│   └── tanstack-query/     # Query client setup + devtools
├── contexts/               # React context providers (theme, etc.)
├── hooks/                  # Shared client hooks (forms, localStorage query)
└── lib/
    └── utils.ts            # cn() re-export shim (import from 'cn')
crates/
└── argon2-do-hasher/    # Rust/Wasm Argon2id kernel for AuthHasher DO
.agents/skills/          # Agent guidance (see note below; contents intentionally not listed)
tools/linters/
├── wunshot/             # DB conformity rules
├── wunstart/            # App-wiring conformity rules
└── anti-slop/           # Type-assertion + slop-pattern rules
compose.yaml                # Postgres 16 + Mailpit for local dev
```

<!-- Agent guidance lives in AGENTS.md + .agents/skills/ — do NOT inventory skills here; the list drifts. -->

Agent coding guidance lives in [`AGENTS.md`](./AGENTS.md) and `.agents/skills/` (project skills take precedence over vendored fallbacks) — intentionally not inventoried here.

## Make it yours

- Replace the glossary in [CONTEXT.md](./CONTEXT.md) with your product's domain language.
- Rename the kit: `package.json` `name` and the `wrangler.jsonc` worker name. Leave `crates/argon2-do-hasher/` and `src/durable-objects/argon2-do-hasher.wasm` alone — the paths are hardcoded in `tools/build-wasm.sh`, the pre-commit hook, and `auth-hasher.ts`.
- Add domain tables under `src/db/models/<domain>/` and ops under `src/db/ops/` — the `.agents/skills/wunshot/` skill documents the conventions (lint-enforced by `tools/linters/wunshot/`).

## Kill the dev server

```bash
lsof -ti :3000 -sTCP:LISTEN | head -1 | xargs kill
```

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
# Install dependencies
bun install

# Build the Wasm hashing kernel once (requires Rust + the wasm32-unknown-unknown target;
# the artifact is gitignored, so this is required after every fresh clone)
bun --bun run build:wasm

# Start postgres (Docker)
docker compose up -d

# Set up your .env.local
# DATABASE_URL=postgres://postgres:mypassword@localhost:5432/postgres

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
├── routeTree.gen.ts        # Auto-generated routes (read-only)
├── styles.css              # Tailwind v4 theme tokens
├── routes/                 # File-based routing (TanStack Router)
├── server-fns/             # TanStack Start server functions
├── middleware/              # Request/function middleware (auth, rate-limit, CSRF)
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
│   ├── transports/         # Mailpit (dev) + Brevo (prod) transports
│   └── templates/          # React Email templates
├── isomorphic/             # Shared validation schemas (server + client)
├── integrations/
│   └── tanstack-query/     # Query client setup + devtools
├── contexts/               # React context providers (theme, etc.)
└── lib/
    ├── utils.ts            # cn() helper
    └── date-helpers.ts
crates/
└── argon2-do-hasher/    # Rust/Wasm Argon2id kernel for AuthHasher DO
docs/
└── adr/                    # Architecture Decision Records (0001-0009)
compose.yaml                # Postgres 16 + Mailpit for local dev
```

## Make it yours

- Replace the glossary in [CONTEXT.md](./CONTEXT.md) with your product's domain language.
- Rename the kit: `package.json` `name`, `wrangler.jsonc` worker name, and the `crates/` directory.
- Add domain tables under `src/db/models/<domain>/` and ops under `src/db/ops/` — `AGENTS.md` documents the conventions.

## Kill the dev server

```bash
lsof -ti :3000 -sTCP:LISTEN | head -1 | xargs kill
```

# wunstart

A full-stack TypeScript starter kit for building your own web app. It ships with auth (sessions + JWT, anon identity, email verification), weight-based ban/rate-limiting, and Effect-wrapped Drizzle on Postgres, and stays provider-agnostic for deployment and email. Clone it, rename it, and build on top.

## Stack

- **Framework**: [TanStack Start](https://tanstack.com/start/latest) ([React](https://react.dev/)) + [TanStack Router](https://tanstack.com/router) + [TanStack Query](https://tanstack.com/query)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) via [Drizzle ORM](https://orm.drizzle.team/), wrapped with [Effect](https://effect.website/)
- **Validation**: [Effect Schema](https://effect.website/docs/schema/introduction/) (via `drizzle-orm/effect-schema`)
- **Code consistency**: [oxlint](https://oxlint.io/) with project plugins (`wunstart`, `wunshot`) and [`anti-slop`](https://github.com/dmmulroy/anti-slop) (vendored), plus [React Doctor](https://www.react.doctor) audits

## Get started

<details>
<summary>For agents:</summary>

- Verify Prerequisites below first (runtime, Docker up and running). Stop and tell the user what is missing rather than pushing through failures.
- Ask for the target directory, app name, and one-line description if the user hasn’t provided them; if they don’t specify a directory or accept the default, use `./<slug>` (a new subdirectory). The target directory must either not exist yet or be empty — if it exists and is not empty, stop and ask; never delete its contents. Use `.` only when the current directory is empty. Turn the name into a lowercase slug (spaces and underscores become hyphens; drop anything outside letters/digits/hyphens) that is 63 characters max, starting and ending with a letter or digit — re-ask if the result is empty or still invalid.
- Use the user’s preferred manager; when they have no preference, default to Bun if it is installed, otherwise use an installed manager. Under any non-Bun manager, run each phase as `<pm> run <script> -- <args>` (e.g. `npm run branch-env -- --yes`). To switch managers, pass `--pm` on install-deps; the target manager must already be installed (e.g. `bun run install-deps --pm pnpm --yes`, or if Bun is missing `npm run install-deps -- --pm pnpm --yes`), then use that manager from there on.
- Ask if they plan to work on multiple things in parallel — mention the worktree option explicitly. Default to Clone + Setup for a single project; only use the worktree layout for parallel work.
- Create the project non-interactively (pass `--yes` to each setup command; non-interactive runs fail rather than prompt without it):

  ```sh
  git clone https://github.com/lotap/wunstart <project-dir>  # use `.` when the target is `./`
  cd <project-dir>  # skip when the target is `./` — already there
  rm -rf .git && git init -b trunk
  bun run app-identity --name <slug> [--description "<one line>"] --yes
  bun run install-deps --yes
  bun run branch-env --yes
  ```

  Verify: start dev in the background with its output captured (`mkdir -p .tmp`, then `nohup <pm> run dev >.tmp/dev.log 2>&1 & echo $! >.tmp/dev.pid`; use `bun run` by default and `<pm> run` for another manager). Foreground blocks, so never run it in the foreground. Read the assigned port from `DEV_PORT` in `.env.local` (also printed by `branch-env`), then wait for boot and check it — dev takes a few seconds, so retry until it answers:

  ```sh
  stop_dev() {
    kill "$(cat .tmp/dev.pid 2>/dev/null)" 2>/dev/null || true
    lsof -ti :<port> -sTCP:LISTEN | head -1 | xargs kill 2>/dev/null || true
  }
  for i in $(seq 1 30); do curl --max-time 2 -fsS -o /dev/null http://localhost:<port>/ && break || sleep 1; done
  curl --max-time 2 -fsS -o /dev/null http://localhost:<port>/ || { tail -n 50 .tmp/dev.log; <pm> run validate-setup; stop_dev; exit 1; }
  stop_dev
  ```

  Only if verify passes, run `<pm> run build`, then make the setup commit (`Initial project setup`) as in Setup step 3. That commit is part of creating the project. If verify or build fails, stop instead of committing: report the captured dev log plus `validate-setup` output for a verify failure, or the build output for a build failure.

  For parallel work, finish this setup and commit first, then follow [Git worktrees](#git-worktrees-for-parallel-work). Don’t commit later changes or push until asked.

- If `git commit` fails because no identity is configured, ask before setting repo-local `user.name`/`user.email` (`git config user.name "..."` / `git config user.email "..."` — no `--global`).
- Read `AGENTS.md` after setup, before building. `CONTEXT.md` is the product glossary.

</details>

### Prerequisites

- A JS runtime + package manager — [Bun](https://bun.sh) 1.x (the default), [nub](https://nubjs.com/docs), or [Node](https://nodejs.org/en) 22.18+ with one of [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/), [aube](https://aube.sh).
- [Docker](https://www.docker.com/products/docker-desktop/) up and running (Postgres + Mailpit via `docker compose`)
- Optional: Rust + the `wasm32-unknown-unknown` target — only if you edit `crates/` for the auth hasher; the wasm kernel is committed, so builds never need it otherwise

### Clone

```sh
git clone https://github.com/lotap/wunstart <project-dir> && cd <project-dir> && rm -rf .git && git init -b trunk
```

Cloning then removing `.git` gives you a fresh repo with no fork relationship and no link back to the starter repo. Your working tree has no commits and no tracked files until you make the first commit.

--- OR ---

A shorter option that skips history: `bunx degit github:lotap/wunstart <project-dir> && cd <project-dir> && git init -b trunk`

--- OR ---

You can also click the “Use this template” button on [the project’s GitHub repository](https://github.com/lotap/wunstart). A template copy starts as a fresh repo with a single `Initial commit` and no fork relationship or shared history with the starter.

### Setup

1. **Set app identity**

   Bun is the default runtime and package manager and is used for the examples below.

   > Under any non-Bun manager, pass script flags after `--` (`npm run branch-env -- --yes`, `pnpm run branch-env -- --yes`, `aube run branch-env -- --yes`) — the manager keeps bare flags for itself. The `bunx` equivalent is `npx` (npm), `pnpm dlx` (pnpm), `yarn dlx` (yarn), or `aubx` (aube).

   Interactive terminal:

   ```sh
   bun run app-identity   # set the project name and description
   ```

   Non-interactive:

   ```sh
   bun run app-identity --name <slug> [--description "<one line>"] --yes
   ```

   `bun run app-identity --help` to see all options.

   `--name` must be a lowercase slug: letters, digits, and hyphens, 63 characters max, starting and ending with a letter or digit. `--description` is optional — omit it to keep the current description, but a new app should set its own rather than ship the starter’s.

   `.env.development` holds local-development secrets (JWT keys, database password). Treat them as dev-only and replace them before any real deployment.

2. **Set up the dev environment**

   ```sh
   bun run install-deps     # one-time per checkout: dependencies + git hooks
   ```

   > To switch package managers, use the `--pm` flag
   >
   > ```sh
   > bun run install-deps --pm pnpm       # from Bun
   > npm run install-deps -- --pm pnpm    # from npm
   > ```

   ```sh
   bun run branch-env       # per branch: database + assigned port + migrations
   ```

   Then serve it (blocking — keep it running in its own terminal):

   ```sh
   bun run dev              # serves the assigned port from .env.local — no flags needed
   ```

   `install-deps` is one-time per checkout. `branch-env` is branch-scoped: run it whenever the branch changes — it provisions that branch’s database, port, and migrations.

   Trunk prefers `:3000`; feature branches claim ports `3100–3199`. Either can shift to the next free port when its claim is taken. Feature branches get their own database (e.g. `wunstart_feat_login_a1b2c3`, generated by `branch-env` from the sanitized branch name); trunk uses the `postgres` database from `.env.development`.

3. **Verify and commit**

   Verify: open the app at the assigned port (printed by `branch-env`, saved as `DEV_PORT` in `.env.local`) and confirm the landing page renders.

   ```sh
   git add -A && git commit -m "Initial project setup"
   ```

4. **(Optional) Create a feature branch**

   ```sh
   git checkout -b <branch>
   bun run branch-env
   ```

   `branch-env` provisions the new branch’s database and port. Restart or start `dev` afterwards so it picks up the new `DEV_PORT`.

---

Stuck? `bun run validate-setup` diagnoses the checkout and tells you the fix.

### Customize

Once setup is complete, you can treat wunstart like a normal [TanStack Start](https://tanstack.com/start/latest) project.

Example prompts for agents:

- Add my logo to the navbar
- Add an admin dashboard
- Add a mailing-list signup to the footer

### Testing

There is no product test suite yet — testing methodology and frameworks are still being explored.

Run `bun run fmt`, `bun run lint:check`, and `bunx tsgo --noEmit` to format and check new code.

Linter rule tests run with `bun run test:lint`; run them when you edit linter rules.

### Deployment

Deployment mechanisms in development. The focus is on simplicity and platform agnosticism.

## Git worktrees (for parallel work)

Use this layout only when you need to work on multiple things at once (e.g. two branches or two agents in parallel); for a single new project, Clone + Setup is enough, and you can convert when the need arises.

<details>
<summary>Worktree layout setup (click to expand)</summary>

Every worktree — including trunk's — gets its own folder. `.bare/` is the repo, branch folders are where you work. Use `git worktree remove`, never `rm -rf`, to drop one.

Convert once, on `trunk`, after making the setup commit (worktrees need a commit to check out). If you branched in Setup step 4, switch back to `trunk` first (`git checkout trunk`). Before converting, `git status --short` must be empty (commit or stash first), and the dev server must be stopped (Teardown step 1) — the conversion deletes the checkout it serves from. This converts `<project-dir>/` in place: the project keeps its path and gains `.bare/` and `trunk/`; no hosting needed, works fully offline.

`clone --bare .` sets `.bare`'s origin to the local path `.`, which breaks once you clean up — so remove it and restore your real origin only if you had one:

```sh
ORIG_URL=$(git remote get-url origin 2>/dev/null || true)
git clone --bare . .bare
git --git-dir=.bare remote remove origin
if [ -n "$ORIG_URL" ]; then git --git-dir=.bare remote add origin "$ORIG_URL"; fi
git --git-dir=.bare worktree add ./trunk trunk
cd trunk
```

Then inside `./trunk`, run `bun run install-deps` and `bun run branch-env`, and verify with `bun run validate-setup`. Only committed files reappear in `trunk/`; `branch-env` state regenerates there.

Once `trunk` verifies, delete the original top-level checkout (committed files are now duplicated in `./trunk/`; this also removes the stale top-level `.git`). Run this from `<project-dir>/` — the previous step left you inside `trunk/`, so `cd ..` first. The path guard aborts unless you are in the right place:

```sh
cd ..
test -d .bare -a -d trunk || { echo "expected ./.bare and ./trunk — cd to <project-dir>/ first"; exit 1; }
git --git-dir=.bare worktree list  # trunk must be listed
ls -A  # preview: everything below except .bare and trunk will be deleted
find . -maxdepth 1 -not -name '.' -not -name '.bare' -not -name 'trunk' -exec rm -rf {} +
cd trunk
```

Add branches only after cleanup, from `trunk`:

```sh
git worktree add ../<branch> <branch>      # existing branch
git worktree add -b <branch> ../<branch>   # new branch
```

Then run `bun run install-deps` and `bun run branch-env` inside each fresh checkout — the same branch name always maps to the same database and preferred ports; ports shift if their claim is taken. Run `bun run validate-setup` inside each new worktree to verify it.

The parent can also hold shared caches and scratch that you create yourself — the layout works without them:

- `.bare/` — the repo itself. Never edit in here; only work in branch folders.
- `.shared-wasm-cache/` — optional place to keep a rebuilt wasm kernel when you edit `crates/`. Run `bun run build:wasm` once, copy `src/durable-objects/argon2-do-hasher.wasm` into this directory, then copy it into each worktree that needs it and commit it; the committed kernel remains the source of truth.
- `.shared-cargo-target/` — point `CARGO_TARGET_DIR` here from your shell to share Rust dependencies across worktrees. Optional; everything works without it.
- `.tmp/` — cross-worktree scratch (e.g. screenshots to compare across branches); branch-local scratch stays in each checkout's own `.tmp/`.

A branch's environment comes from its git branch, not its folder — renaming the folder changes nothing; if you repurpose a worktree to another branch, re-run `branch-env`.

Each worktree is self-contained: run `install-deps` and `branch-env` inside it. Run `app-identity` once on `trunk` before converting so all worktrees inherit it; never re-run it per worktree.

Feature branches get their own database (`wunstart_<branch>_<6hex>`, generated by `branch-env` from the sanitized branch name); trunk uses the `postgres` database from `.env.development`. So two agents in two worktrees normally get separate databases and ports.

If a worktree already has its own Postgres container, `branch-env` reuses/restarts it. Otherwise it uses a reachable Postgres at the committed `DATABASE_URL` (normally `localhost:5432`, no new container), or starts its own stack on a free port. `branch-env --dry-run` prints the plan and claimed ports without changing anything, but it does not probe shared Postgres credentials, so the shared-vs-own choice stays conditional.

Per-worktree overrides live in gitignored `.env.local` (written by `branch-env`, read by the dev server, `db:*` scripts, and validate-setup).

`branch-env` owns `DATABASE_URL`, `DEV_PORT`, and `MAILPIT_URL`; other keys you add survive re-runs. Delete `.env.local` and re-run `branch-env` to regenerate the managed keys (the dev server needs `DEV_PORT`).

When the branch is done, follow Teardown steps 2–3 below (drop DB, then `down` — never `-v` on shared storage), then from `trunk`, remove the worktree (`git worktree remove <path>` — find it with `git worktree list`).

</details>

## Teardown

1. **Kill the dev server** (replace `<port>` with `DEV_PORT` from `.env.local`; trunk normally claims `3000` but shifts if it is taken):

   ```sh
   lsof -ti :<port> -sTCP:LISTEN | head -1 | xargs kill || true
   ```

2. **Drop the branch database** (the name is `wunstart_<branch>_<6hex>`, where `<branch>` is the sanitized branch name; the exact value is in `branch-env`’s plan output, or in `DATABASE_URL` in `.env.local`). Skip this on trunk: it uses the `postgres` database from `.env.development`, which must not be dropped.

   From the worktree that owns the container:

   ```sh
   docker compose exec postgres psql -U postgres -c 'DROP DATABASE "wunstart_<branch>_<6hex>"'
   ```

   Or against any running postgres container (find it with `docker ps`):

   ```sh
   docker exec <postgres-container> psql -U postgres -c 'DROP DATABASE "wunstart_<branch>_<6hex>"'
   ```

3. **Stop this worktree’s stack** (keeps data volumes):

   ```sh
   docker compose down
   ```

   `docker compose down -v` also deletes this worktree’s data volume: only run it on an own stack, never when the Postgres container is shared.

## Project structure

<!-- Map, not inventory: directories first (A-Z), then files (A-Z). Files only when they are stable landmarks (entry points, shared utilities, rule-carrying names). Per-feature files — and skill contents — are never listed. -->

```
.agents/skills/                # Agent guidance (contents never listed)
crates/
└── argon2-do-hasher/          # Rust/Wasm Argon2id kernel for AuthHasher DO
src/
├── components/
│   ├── auth/                  # Sign-in, sign-up, password-change forms
│   ├── form-fields/           # Shared form field components
│   └── ui/                    # shadcn components
├── contexts/                  # React context providers (theme, etc.)
├── db/
│   ├── helpers/               # Table factories, query/archive helpers, validators
│   ├── migrations/            # Drizzle-generated SQL migrations
│   ├── models/                # Per-domain schemas, queries, validations, cascades
│   ├── ops/                   # Effect-based business operations (auto activity logging)
│   └── index.ts               # Effect-wrapped Drizzle client
├── durable-objects/           # AuthHasher DO: class + committed wasm kernel
│   ├── argon2-do-hasher.wasm  # committed kernel — rebuild via `bun run build:wasm`, never hand-edit
│   └── auth-hasher.ts         # DO class (password hashing via Wasm)
├── email/
│   ├── templates/             # React Email templates
│   ├── transports/            # Mailpit (dev) + prod transports
│   ├── layer.ts               # Dev/prod email layer wiring
│   └── service.ts             # EmailService Effect service
├── hooks/                     # Shared client hooks (forms, localStorage query)
├── integrations/
│   └── tanstack-query/        # Query client setup + devtools
├── isomorphic/                # Shared validation schemas (server + client)
├── lib/                       # Shared utilities
├── middleware/                # Request/function middleware (auth, rate-limit, CSRF)
├── routes/                    # File-based routing (TanStack Router)
├── scripts/                   # One-off scripts (archive-old-activities)
├── server-fns/                # TanStack Start server functions
├── app-info.ts                # Committed app identity (name/description; managed by app-identity)
├── routeTree.gen.ts           # Generated routes (don’t hand-edit)
├── router.tsx                 # Router factory (wired to TanStack Query)
├── server.ts                  # Cloudflare Workers entry point
├── start.ts                   # createStart app factory + middleware
└── styles.css                 # Tailwind v4 theme tokens
tools/
├── git-hooks/
│   └── pre-commit             # Staged-wasm guard for crates/ edits
├── helpers/                   # Neutral TS libraries shared by phases and checks
├── linters/
│   ├── anti-slop/             # Type-assertion + slop-pattern rules
│   ├── wunshot/               # DB conformity rules
│   └── wunstart/              # App-wiring conformity rules
├── pkg-scripts/               # Executable entries, run via package scripts
└── setup/
    ├── app-identity/          # Project identity phase (stateless, dependency-free)
    ├── branch-env/            # Branch environment phase
    └── install-deps/          # Checkout dependency phase
AGENTS.md                      # agent instructions — source of truth, read first
CONTEXT.md                     # product glossary for agents
compose.yaml                   # Postgres 16 + Mailpit for local dev
drizzle.config.ts              # drizzle-kit config (db:* scripts use the default path)
package.json                   # scripts (run everything through these) + managed identity fields
```

## License

MIT — see [LICENSE](./LICENSE). Third-party notices (shadcn/ui components, fonts) remain under their own licenses.

## Legal & Security

All code is provided as-is, with no claim or guarantee of legal compliance with regard to PII or data handling. It is your responsibility to comply with the laws in which your application operates.

No promises can be made about security. The authors are not responsible for any vulnerabilities, exploits, or other processing that results in a leak or exposure of data. It is your responsibility to review any and all code used to serve your users.

## Contributing

Wunstart has a benevolent dictator for life (BDFL) for now.

No external PRs are accepted while it is in early development.

You may [file issues](https://github.com/lotap/wunstart/issues) or fork it and make it yours.

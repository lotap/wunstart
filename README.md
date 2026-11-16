# wunstart

A full-stack TypeScript starter kit for building web apps.

- Auth (sessions and JWT, anon identity, email verification)
- Weight-based bans and rate limiting
- Effect-wrapped Drizzle on Postgres
- No deployment platform lock-in[*](#deployment)

Clone it, rename it, and start building.

## Stack

- **Framework.** [TanStack Start](https://tanstack.com/start/latest) ([React](https://react.dev/)), [TanStack Router](https://tanstack.com/router), and [TanStack Query](https://tanstack.com/query)
- **Styling.** [Tailwind CSS](https://tailwindcss.com/) and [shadcn/ui](https://ui.shadcn.com/)
- **Database.** [PostgreSQL](https://www.postgresql.org/) with [Drizzle ORM](https://orm.drizzle.team/), wrapped with [Effect](https://effect.website/)
- **Validation.** [Effect Schema](https://effect.website/docs/schema/introduction/) (through `drizzle-orm/effect-schema`)
- **Linting.** [oxlint](https://oxlint.io/) with project plugins (`wunstart`, `wunshot`) and [`anti-slop`](https://github.com/dmmulroy/anti-slop) (vendored), and [React Doctor](https://www.react.doctor) audits

## Get started

<details>
<summary>For agents:</summary>

- Check the prerequisites below first: a JavaScript runtime, a package manager, and Docker running. If something is missing, stop and tell the user what it is. Do not push through failures.
- Ask for the target directory, app name, and one-line description if the user hasn’t provided them. If they don’t specify a directory or accept the default, use `./<slug>` (a new subdirectory). The target directory must not exist yet, or it must be empty. If it exists and is not empty, stop and ask. Never delete its contents. Use `.` only when the current directory is empty. Turn the name into a lowercase slug of at most 63 characters that starts and ends with a letter or digit. Replace spaces and underscores with hyphens, and drop any other character that is not a letter, digit, or hyphen. Re-ask if the result is empty or still invalid.
- Use the user’s preferred manager. If they have no preference, use Bun when it is installed; otherwise use another installed manager. npm is the only manager that needs `--` to forward script args (`npm run branch-env -- --yes`); Bun, Nub, pnpm, yarn, and aube take them directly (for example, `nub run branch-env --yes`). To switch managers, pass `--pm` to `install-deps`. The target manager must already be installed (for example, `bun run install-deps --pm pnpm --yes`). If Bun is missing, run `npm run install-deps -- --pm pnpm --yes` instead. Then use that manager for the remaining commands.
- Ask whether they plan to work on more than one thing at a time. Mention the worktree option. Default to the Clone and Setup steps for a single project, and use the worktree layout only for parallel work.
- Create the project with flags so it never prompts. Pass `--yes` to each setup command. Non-interactive runs fail instead of prompting without it:

  ```sh
  git clone https://github.com/lotap/wunstart <project-dir>  # use `.` when the target is `./`
  cd <project-dir>  # skip when the target is `./`, you are already there
  rm -rf .git && git init -b trunk
  bun run app-identity --name <slug> [--description "<one line>"] --yes
  bun run install-deps --yes
  bun run branch-env --yes
  ```

  To verify, run `bun run agent-dev start`, use `<pm> run` for another manager. It reuses a dev server already running in this worktree when its `DATABASE_URL` matches the current one. Otherwise it reuses or starts the branch’s shared agent server. It waits until the server answers over HTTP and prints the URL. Do not start `dev` in the background and do not stop servers afterward. Agent servers exit on their own after 15 minutes idle.

  ```sh
  bun run agent-dev start
  # open the printed http://localhost:<port>
  ```

  Under npm, use `npm run agent-dev -- start`. The fresh variant is `npm run agent-dev -- start --fresh`.

  `start` reuses the dev server in this worktree when its `DATABASE_URL` matches. Otherwise it reuses the branch’s shared agent server for the branch database, or starts one. When it starts a server, it provisions dependencies, waits until the server answers over HTTP, and prints the URL first. Use that printed URL.

  `status` is read-only and does not reset idle timers. It shows port, pid, worktree ownership, role, and log. Agent logs live at `.tmp/agent-dev/<port>.log`; the human server logs to the terminal that runs it. If the server fails to start, run `status` and read the listed log.

  Never stop the dev server or a shared server. `stop-all` is manual cleanup. Stop only a fresh server you started, with `stop --port <port>`.

  `start --fresh` starts an additional instance with its own port, Cloudflare state, log, and idle timer. It still shares files, HMR, git, and the database. Both exit after 15 minutes idle. Set `AGENT_DEV_IDLE_MS` to change the window. `AGENT_DEV_MAX_SERVERS` caps shared and fresh servers per worktree at 4 by default.

  `branch-env` runs per branch. Run it again after a branch switch, when `validate-setup` reports `DEV_PORT`/`AGENT_DEV_PORT` missing, or when the branch database was dropped or Postgres is unreachable. `branch-env` keeps a stored agent port only when the listener is this worktree’s shared agent Vite for the branch database and connection URL. Otherwise it shifts to the next free port.

  If the command exits nonzero, run `bun run agent-dev status`, report the log path it lists and the `<pm> run validate-setup` output instead of committing. If it passes, run `<pm> run build`, then make the setup commit named `Initial project setup` as described in Setup step 3. That commit is part of creating the project. For a failed build, report the build output.

  For parallel work, finish this setup and commit first, then follow [Git worktrees](#git-worktrees-for-parallel-work). Do not commit later changes or push until asked.

- If `git commit` fails because no identity is configured, ask before setting repo-local `user.name`/`user.email` (`git config user.name "..."` / `git config user.email "..."`, no `--global`).
- Read `AGENTS.md` after setup, before building. `CONTEXT.md` is the product glossary.

</details>

### Prerequisites

- A JavaScript runtime and package manager: [Bun](https://bun.sh) 1.x, the default runtime and package manager, [Nub](https://nubjs.com/docs), a runtime and package manager, or [Node](https://nodejs.org/en) 22.18+ with one of [npm](https://www.npmjs.com/), [yarn](https://yarnpkg.com/), [pnpm](https://pnpm.io/) 12.7+ (needed for build approvals), or [aube](https://aube.sh).
  > If you have a Bun-only setup, you will need to manually update the `opencode.json` file to use `bunx` instead of `npx` for MCP servers.
- [Docker Engine](https://docs.docker.com/engine/install/) with [Compose](https://docs.docker.com/compose/install/) installed and running. Docker Desktop, OrbStack, or another Docker-compatible runtime works. It starts Postgres and Mailpit through `docker compose`.
- Rust and the `wasm32-unknown-unknown` target are optional. You need them only if you edit `crates/` for the auth hasher. The compiled wasm kernel is committed, so no other build needs Rust.

### Clone

```sh
git clone https://github.com/lotap/wunstart <project-dir> && cd <project-dir> && rm -rf .git && git init -b trunk
```

Cloning and removing `.git` leaves a fresh repo with no link back to the starter. The repo has no commits or tracked files until you make the first commit.

Or

If you have a package manager already, use `degit` through its one-off runner — `bunx` (Bun), `npx` (npm), `pnpm dlx` (pnpm), `yarn dlx` (yarn), `aubx` (aube), or `nubx` (Nub):

```sh
<one-off runner> degit github:lotap/wunstart <project-dir> && cd <project-dir> && git init -b trunk
```

Or

Click “Use this template” on [the project’s GitHub repository](https://github.com/lotap/wunstart). A template copy creates a fresh repo with a single `Initial commit`, no fork relationship, and no shared history with the starter.

### Setup

1. **Set app identity.**

   The examples below use Bun, the default runtime and package manager.

   <details>
   <summary>For other runtimes and package managers:</summary>

   Only npm needs `--` before script flags (`npm run branch-env -- --yes`); Bun, Nub, pnpm, yarn, and aube take the args directly (`pnpm run branch-env --yes`, `nub run branch-env --yes`). Bare flags go to the manager, not the script. For one-off packages, use `npx` (npm), `pnpm dlx` (pnpm), `yarn dlx` (yarn), `aubx` (aube), or `nubx` (Nub) instead of `bunx`.
   </details>

   Interactive terminal:

   ```sh
   bun run app-identity   # set the project name and description
   ```

   Non-interactive:

   ```sh
   bun run app-identity --name <slug> [--description "<one line>"] --yes
   ```

   Run `bun run app-identity --help` to see all options.

   `--name` must be a lowercase slug of at most 63 characters. It can contain letters, digits, and hyphens, and must start and end with a letter or digit. `--description` is optional. Omit it to keep the current description, but a new app should set its own.

2. **Set up the dev environment.**

   `.env.development` holds secrets for local development, like JWT keys and the database password. Use them only in development and replace them before you deploy.

   ```sh
   bun run install-deps     # one-time per checkout: dependencies, git hooks
   ```

   > To switch package managers, use the `--pm` flag.
   >
   > ```sh
   > bun run install-deps --pm pnpm       # from Bun
   > npm run install-deps -- --pm pnpm    # from npm
   > ```
   >
   > Switching to pnpm (12.7+) may create `pnpm-workspace.yaml` to record build approvals. The switch generates it; it is not part of the Bun checkout. Older pnpm rejects the build-approval flags, so `install-deps` stops before changing anything.

   ```sh
    bun run branch-env       # per branch database and agent port, plus migrations
   ```

   Then serve it. The dev server blocks, so keep it running in its own terminal:

   ```sh
   bun run dev              # dev server on :3000 in every worktree
   ```

   > Agents use `bun run agent-dev start` instead. See “For agents” above.

   `branch-env` runs per branch. Run it again after a branch switch. It sets up that branch’s database and ports.

   Feature branches get their own database, for example `wunstart_feat_login_a1b2c3`. Trunk uses the `postgres` database from `.env.development`.

3. **Verify and commit.**

   To verify, open `http://localhost:3000` and confirm the root home renders. The marketing page is separate, at `/landing-page`.

   ```sh
   git add -A && git commit -m "Initial project setup"
   ```

4. **(Optional) Create a feature branch.**

   ```sh
   git checkout -b <branch>
   bun run branch-env
   ```

   `branch-env` sets up the new branch’s database and agent port. `DEV_PORT` stays `3000` unless you pinned it; `branch-env --dev-port <port>` stores the pin in `.env.local`, and later runs keep it. Restart `dev` whenever `DATABASE_URL` changes, like a branch switch or Postgres move, regardless of the port.

   > Agents run `bun run agent-dev start` after `branch-env`. It starts a new server for the new database instead of reusing a server on the old one.

---

If setup fails, run `bun run validate-setup`. It reports what is wrong and how to fix it.

### What runs on its own

The repo has some automated processes designed to make development easier. But they can result in some brittleness and unexpected behavior.

**On install.** Setting up dependencies runs the [`prepare` script](https://docs.npmjs.com/cli/v11/using-npm/scripts). It tells git to use the repo's own commit hook, described below, and it modifies the installed TypeScript and Oxlint copies, inside `node_modules` only, to add Effect checks. `install-deps` triggers it through a normal install, and so does any later `bun install`, `add`, or `remove`.

**The commit hook.** The hook blocks Rust changes that reach a commit without the rebuilt Wasm file alongside them. The kernel binary is committed so daily work never needs the Rust toolchain.

**The patched compiler.** The modified compiler is why `bunx tsc --version` shows an `+effect-tsgo` suffix and why the `@effect/language-service` block in `tsconfig.json` does anything at all. If Effect checks ever stop appearing, reinstall and look for the suffix.

**On a server start.** Starting the dev server or starting a new agent server reinstalls dependencies first, so switching branches or pulling never leaves the checkout broken. Reusing a running server skips that check.

**Config files beat exports.** The dev server and the database scripts load `.env.development` then `.env.local`, and the files win over anything exported in the shell, with `.env.local` winning between the two. `branch-env` owns the per-worktree values there, like `DATABASE_URL`, ports, and mail URLs. Anything else you add survives beside them. So a `DATABASE_URL` exported from another checkout never leaks across, and overrides belong in `.env.local`, never in exports. The one exception is the `archive-old-activities` cron job, which reads an exported `DATABASE_URL` first because production has no files.

**Double Effect reports are on purpose.** The typecheck `bunx tsc --noEmit` and the linter `bun run lint:check` share most of their Effect checks, so some findings appear in both. That overlap is on purpose. The typecheck runs 43 checks the linter cannot. Only errors fail the typecheck. Warnings and suggestions do not fail it.

### Customize

After setup, wunstart works like any other [TanStack Start](https://tanstack.com/start/latest) project.

**Read the in-repo docs.** With the dev server running, open `/docs`. It covers the stack, the local services (Mailpit, Drizzle Studio), and the auth features. The page is dev-only — production builds omit the route and tree-shake the page implementation — so extend it freely: add a feature entry in `src/routes/_dev/docs/-content/features.ts` and its panel in `src/routes/_dev/docs/-components/`. Keep getting-the-checkout-running steps in this README and agent rules in `.agents/skills`; `/docs` describes the app you are building.

Example prompts for agents:

- Add my logo to the navbar
- Add an admin dashboard
- Add a mailing-list signup to the footer
- Setup this project to use worktrees

### Testing

There is no product test suite yet.

Run `bun run check` for the full compliance gate: `fmt:check`, `lint:check`, `lint:tailwind`, `bunx tsc --noEmit`, and `db:check`, in that order and fail-fast. Run `bun run fmt` first to apply formatting.

Linter rule tests run with `bun run test:lint`. Run them when you edit linter rules.

### Updating dependencies

Three things update three ways:

- **npm packages.** Update `package.json` and `bun.lock` with `bun update -i`, then `bun run install-deps`.
  - Caveats:
    - Keep `ua-parser-js` on v1. Version 2 relicensed from MIT to AGPL.
    - Keep TanStack Form on the v2 prerelease line, since the interactive updater lists the older v1 stable as an update. Don't take it.
    - Keep Drizzle ORM and Drizzle Kit on the v1 release-candidate line (currently rc.5). The updater lists the older 0.x stable as an update. Don't take it. After a kit bump, run `db:up` then `db:generate` and expect no schema changes.
    - Keep the `solid-js` override at 1.9.17. The TanStack devtools are Solid-based, and without the override Bun installs nested copies that warn in the browser console about duplicate Solid instances and undisposed computations. The app itself is React. Remove the override only when a clean install resolves one copy.
- **Skills.** `.agents/skills` holds managed skills. `npx skills check` shows what has drifted. `npx skills update` refreshes them.
- **Lint rules:**
  - _Anti-slop_ in `tools/linters/anti-slop/`. Paste this to an agent:
    ```
    Update anti-slop to latest while preserving local customizations.
    ```
    The agent identifies the revision and records it in `UPSTREAM.md`. Name a specific commit only to port selected fixes instead of everything.
  - _React Doctor_. `bun update oxlint-plugin-react-doctor` is the whole update. The merge loop at the top of `oxlint.config.ts` applies the new rules on the next lint, with nothing else to run. You only step in for two edge cases. Both are visible in `bun run lint:check` output: a brand-new upstream set worth merging, or a renamed rule ID referenced in `doctor.config.json`. The `improve-react` scanner runs at `@latest`, so it needs no update.

### Deployment

_By default, the auth module deploys a hashing method ([Argon2](https://en.wikipedia.org/wiki/Argon2)) using [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/). To use a different architecture, use a different hashing algorithm._

Deployment support is still in development. The focus is on simplicity and platform agnosticism.

## Git worktrees (for parallel work)

Use this layout only when you need to work on more than one thing at a time, such as two branches or two agents in parallel. For a single new project, the Clone and Setup steps are enough. You can convert later if you need to.

<details>
<summary>Worktree layout setup</summary>

Every worktree, including trunk’s, gets its own folder. `.bare/` is the repo. Branch folders are where you work. Use `git worktree remove`, never `rm -rf`, to remove one.

Convert once, on `trunk`, after you make the setup commit. A worktree needs a commit to check out. If you branched in Setup step 4, switch back to `trunk` first with `git checkout trunk`. Before converting, `git status --short` must be empty, so commit or stash any changes. Stop the dev server, see Teardown step 1. This converts `<project-dir>/` in place. The project keeps its path and gains `.bare/` and `trunk/`. A later step deletes the original checkout. This needs no hosting and works fully offline.

`git clone --bare . .bare` sets `.bare`’s origin to the local path `.`, which breaks once you delete the original checkout. Remove that origin, then restore your real origin if you had one:

```sh
ORIG_URL=$(git remote get-url origin 2>/dev/null || true)
git clone --bare . .bare
git --git-dir=.bare remote remove origin
if [ -n "$ORIG_URL" ]; then git --git-dir=.bare remote add origin "$ORIG_URL"; fi
git --git-dir=.bare worktree add ./trunk trunk
cd trunk
```

Inside `./trunk`, run `bun run install-deps` and `bun run branch-env`, then verify with `bun run validate-setup`. Only committed files appear in `trunk/`. `branch-env` recreates `.env.local` and sets up the database plus its dev and agent ports.

Once `trunk` passes `validate-setup`, delete the original top-level checkout. Its committed files are now in `./trunk/`, and deleting the checkout also removes the stale top-level `.git`. Run this from `<project-dir>/`. The previous step left you inside `trunk/`, so run `cd ..` first. The path guard stops you if you are in the wrong place:

```sh
cd ..
test -d .bare -a -d trunk || { echo "expected ./.bare and ./trunk, cd to <project-dir>/ first"; exit 1; }
git --git-dir=.bare worktree list  # trunk must be listed
ls -A  # preview: everything below except .bare and trunk will be deleted
find . -maxdepth 1 -not -name '.' -not -name '.bare' -not -name 'trunk' -exec rm -rf {} +
cd trunk
```

After cleanup, add branches from `trunk`:

```sh
git worktree add ../<branch> <branch>      # existing branch
git worktree add -b <branch> ../<branch>   # new branch
```

Then run `bun run install-deps` and `bun run branch-env` inside each new checkout. A branch name always maps to the same database and preferred agent port. `branch-env` keeps that port only for this worktree’s live shared agent server on the same branch database. If it is busy or belongs to a stale or foreign server, it picks the next free one. Run `bun run validate-setup` inside each new worktree to verify it.

OpenCode can create a worktree for you. `opencode.json` sets `worktree.directory` to `..`, so a worktree created from OpenCode appears beside `trunk` like the manual ones. OpenCode then runs the project’s startup script; set it once in the project’s settings to `bun run install-deps --yes && bun run branch-env --yes`, or run both commands in the new checkout yourself and finish with `bun run validate-setup`. The startup script is stored in OpenCode, not in `opencode.json`, so it does not travel with the repository. Start OpenCode in a branch folder such as `trunk`, never in `.bare`: `.bare` is not a working checkout and has none of the repository instructions.

You can also keep shared caches and scratch files in the parent folder. The layout works without them:

- `.bare/` is the repo itself. Never edit it. Only work in the branch folders.
- `.shared-wasm-cache/` is an optional place to keep a rebuilt wasm kernel when you edit `crates/`. Run `bun run build:wasm` once, copy `src/durable-objects/argon2-do-hasher.wasm` into this directory, then copy it into each worktree that needs it and commit it. Builds still use the committed kernel.
- `.shared-cargo-target/` is a directory for `CARGO_TARGET_DIR`. Point the variable there from your shell to share Rust dependencies across worktrees. Everything works without it.
- `.tmp/` is for cross-worktree scratch files, such as screenshots to compare across branches. Branch-local scratch stays in each checkout’s own `.tmp/`.

A branch’s environment comes from its git branch, not its folder. Renaming the folder changes nothing. If you repurpose a worktree for another branch, re-run `branch-env`.

Each worktree has its own setup. Run `install-deps` and `branch-env` inside it. Run `app-identity` once on `trunk` before converting so all worktrees use the same identity. Never re-run it per worktree.

Feature branches get their own database, for example `wunstart_<branch>_<6hex>`, which `branch-env` generates from the sanitized branch name. Trunk uses the `postgres` database from `.env.development`. Two agents in two worktrees usually get separate databases and agent ports. Dev servers all default to `:3000`, so run one at a time. `--dev-port` is the rare override.

If a worktree already has its own Postgres container, `branch-env` reuses or restarts it. Otherwise it uses a reachable Postgres at the `DATABASE_URL` from `.env.development`, normally `localhost:5432`, with no new container, or starts its own stack on a free port. `branch-env --dry-run` prints the plan and ports without changing anything, but it does not check the credentials of the shared Postgres, so it cannot tell you in advance whether it will use the shared database or start its own.

`branch-env` writes per-worktree overrides to the gitignored `.env.local`. The dev server, `db:*` scripts, and `validate-setup` read that file.

`branch-env` manages `DATABASE_URL`, `DEV_PORT`, `AGENT_DEV_PORT`, and `MAILPIT_URL`. Other keys you add survive re-runs. Delete `.env.local` and re-run `branch-env` to regenerate the managed keys. The dev server uses `DEV_PORT`, `3000` by default. Agents use `AGENT_DEV_PORT`. A worktree created before agent-dev existed needs one `bun run branch-env` run to add `AGENT_DEV_PORT` and keep a valid `DEV_PORT` (invalid or agent-range values are repaired to `3000`). `validate-setup` reports the missing key.

When you finish the branch, follow Teardown below: stop this worktree’s agent servers, drop the database, then run `docker compose down`. Never pass `-v` when storage is shared. Then from `trunk`, remove the worktree with `git worktree remove <path>`. Find the path with `git worktree list`.

</details>

## Teardown

1. **Stop the dev servers.** Press Ctrl-C in the terminal where `dev` runs. Then run `bun run agent-dev stop-all`. It stops this worktree’s agent servers and reaps orphaned workerd processes. Agents skip this step. Servers exit on their own after 15 minutes idle, so agents leave them running.

2. **Drop the branch database.** The name is `wunstart_<branch>_<6hex>`, where `<branch>` is the sanitized branch name. The exact name is in `branch-env`’s plan output or in the `DATABASE_URL` value in `.env.local`. Skip this on trunk. Trunk uses the `postgres` database from `.env.development`, and you must not drop it.

   From the worktree that runs the container:

   ```sh
   docker compose exec postgres psql -U postgres -c 'DROP DATABASE "wunstart_<branch>_<6hex>"'
   ```

   Or run the command against any running Postgres container. Find the container name with `docker ps`:

   ```sh
   docker exec <postgres-container> psql -U postgres -c 'DROP DATABASE "wunstart_<branch>_<6hex>"'
   ```

3. **Stop this worktree’s stack.** This leaves the data volumes in place:

   ```sh
   docker compose down
   ```

   `docker compose down -v` also deletes this worktree’s data volume. Only run it on a stack that belongs to this worktree, never when the Postgres container is shared.

## Project structure

<!-- Directories first, then files, both alphabetical. List a file only when it is a stable landmark: an entry point, a shared utility, or a name that carries a rule. Do not list per-feature files or skill contents. -->

```
.agents/skills/                # Agent guidance (contents never listed)
crates/
└── argon2-do-hasher/          # Rust/Wasm Argon2id kernel for AuthHasher DO
src/
├── components/
│   ├── architecture/          # Framework/route diagrams shared by docs + landing preview
│   ├── auth/                  # Sign-in, sign-up, password-change forms
│   ├── form-fields/           # Shared form field components
│   ├── global/                # App shell + domain-agnostic components
│   └── ui/                    # shadcn components
├── contexts/                  # React context providers (theme, etc.)
├── db/
│   ├── helpers/               # Table factories, query/archive helpers, validators
│   ├── migrations/            # Drizzle-generated SQL migrations
│   ├── models/                # Per-domain schemas, queries, validations, cascades
│   ├── ops/                   # Effect-based business operations (auto activity logging)
│   └── index.ts               # Effect-wrapped Drizzle client
├── durable-objects/           # AuthHasher DO: class + committed wasm kernel
│   ├── argon2-do-hasher.wasm  # committed kernel, rebuild via `bun run build:wasm`, never hand-edit
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
├── routes/                    # File-based routing; <segment>/route.tsx, (<page>)/index.tsx, private -components/ -hooks/ -utils/ -content/
├── scripts/                   # One-off scripts (archive-old-activities)
├── server-fns/                # TanStack Start server functions
├── app-info.ts                # Committed app identity (name/description; managed by app-identity)
├── routeTree.gen.ts           # Generated dev route tree (don’t hand-edit); production tree in .tanstack/
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
│   ├── tailwind/              # Tailwind IntelliSense diagnostics
│   ├── wunshot/               # DB conformity rules
│   └── wunstart/              # App-wiring conformity rules
├── pkg-scripts/               # Executable entries, run via package scripts
└── setup/
    ├── app-identity/          # Project identity phase (stateless, dependency-free)
    ├── branch-env/            # Branch environment phase
    └── install-deps/          # Checkout dependency phase
AGENTS.md                      # agent instructions, read first
CONTEXT.md                     # product glossary for agents
compose.yaml                   # Postgres 16 + Mailpit for local dev
drizzle.config.ts              # drizzle-kit config (db:* scripts use the default path)
package.json                   # scripts (run everything through these) + managed identity fields
```

## License

MIT. See [LICENSE](./LICENSE). Third-party code, including shadcn/ui components and fonts, keeps its own license.

## Liability and security

All code is provided as-is. It comes with no claim or guarantee of legal compliance for personally identifiable information (PII), data handling, or any other regulations. You are responsible for complying with the laws that apply where you operate your application.

We make no promises about security. The authors are not responsible if a vulnerability, exploit, or any form of data processing leaks or exposes data. You are responsible for reviewing all code used to serve your users.

## Contributing

Wunstart has a benevolent dictator for life (BDFL) for now.

The maintainer does not accept external PRs while the project is in early development.

You can [file an issue](https://github.com/lotap/wunstart/issues) or fork the project.

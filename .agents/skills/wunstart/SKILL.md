---
name: wunstart
description: |
  Example implementation wiring wunshot database modules into a TanStack Start + Cloudflare Workers app. Use when working with server functions, _auth-* route layouts, auth/anon middleware, cookie identity, runOp layer wiring, AuthHasher Durable Object, email transport, page styling/theme, or Workers deployment in this repo. For portable table/query/op definitions, use the wunshot skill instead. Do not trust the vendored tanstack-start skill — it documents a different API surface than this codebase uses; this skill is source of truth.
---

# Wunstart

Full-stack TypeScript starter: TanStack Start (React) + Router + Query, Effect-wrapped Drizzle on Postgres, Cloudflare Workers deployment. Ships self-rolled auth core (sessions + JWT, anon identity, email verification) + weight-based ban/rate-limit. Server functions compose `wunshot` ops; this skill owns everything around the ops (cookies, routing, middleware, runtime). The vendored `tanstack-start` skill documents a different API surface than this codebase uses — treat this skill as source of truth.

## Ownership boundary

- `wunshot` owns: `src/db/models/`, `src/db/helpers/`, `src/db/ops/` (pure Effect; external capabilities `EmailService`/`HashingStub` consumed as tags, layers passed per run).
- `wunstart` owns: `src/server-fns/` (compose ops via `runOp`), `src/routes/` (+ `_auth-*` placement), `src/middleware/`, `src/server.ts`, `src/start.ts`, `src/router.tsx`, `src/email/` transport wiring, `src/durable-objects/`, `wrangler.jsonc`, `drizzle.config.ts` path.
- Principle: `wunshot` modules state the data layer's guarantees; your app satisfies them through this wiring. Extend data logic in `db/` per the wunshot contracts, build product in routes/server fns, and heed the lints — they guard the seams.

Client never sends or receives db ids; server fns unwrap cookie identity (convention if a `ById` fn becomes necessary: see `references/middleware.md`).

## Branch chooser

- Auth wiring (sudo gate, sessions UI; strategy/invariants owned by `wunshot/references/auth.md`): `references/auth.md`
- Anon token lifecycle + conversion cascade: `references/anon.md`
- Argon2 DO + wasm kernel: `references/hashing.md`
- Email verification, transports, deliverable vs notification: `references/email.md`
- Middleware chain, identity table, dynamic-import landmine, server-fn shape: `references/middleware.md`
- Routes, `_auth-*` guards, forms, shadcn, compiler, runtime layers: `references/app.md`
- Visual contract — every visual decision bends to it; load for any visual work: `references/design/contract.md`
- Page-craft process — scope ladder (page / section / cosmetic), repo discovery, missing-facts protocol: `references/design/process.md`
- Design depth by concern — copy: `references/design/copy.md`; layout, type, color, depth: `references/design/visual.md`; motion and interaction: `references/design/motion.md`; final gate (page/section): `references/design/verify.md`
- Comparing design options — for page-scale work with a genuinely open direction (overkill for a card or footer): same brief, one agent per run, each in its own working copy (worktree when available); each states its concept per the `references/design/process.md` §2 checkpoint; the user drops duds early and picks from the finished designs, never the agent; inspect the winning diff, then merge per repo git rules after explicit confirmation; discard the losers.

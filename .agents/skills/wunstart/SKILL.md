---
name: wunstart
description: |
  Example implementation wiring wunshot database modules into a TanStack Start + Cloudflare Workers app. Use when working with server functions, _auth-* route layouts, auth/anon middleware, cookie identity, runOp layer wiring, AuthHasher Durable Object, email transport, or Workers deployment in this repo. For portable table/query/op definitions, use the wunshot skill instead. Do not trust the vendored tanstack-start skill — it contradicts this codebase (documents .handler, zod, Nitro, createAPIFileRoute; code uses .server, Effect Schema, @cloudflare/vite-plugin).
---

# Wunstart

Full-stack TypeScript starter: TanStack Start (React) + Router + Query, Effect-wrapped Drizzle on Postgres, Cloudflare Workers deployment. Ships self-rolled auth core (sessions + JWT, anon identity, email verification) + weight-based ban/rate-limit. Server functions compose `wunshot` ops; this skill owns everything around the ops (cookies, routing, middleware, runtime).

## Ownership boundary

- `wunshot` owns: `src/db/models/`, `src/db/helpers/`, `src/db/ops/` (pure Effect, layers passed per run).
- `wunstart` owns: `src/server-fns/` (compose ops via `runOp`), `src/routes/` (+ `_auth-*` placement), `src/middleware/`, `src/server.ts`, `src/start.ts`, `src/router.tsx`, `src/email/` transport wiring, `src/durable-objects/`, `wrangler.jsonc`, `drizzle.config.ts` path.

Client never sends or receives db ids; server fns unwrap cookie identity (no `ById` fns exist today — convention if one appears: see `references/middleware.md`).

## Branch chooser

- Auth strategy, refresh rotation, session listing, no per-session revoke: `references/auth.md`
- Anon token lifecycle + conversion cascade: `references/anon.md`
- Argon2 DO + wasm kernel: `references/hashing.md`
- Email verification, transports, deliverable vs notification: `references/email.md`
- Middleware chain, identity table, dynamic-import landmine, server-fn shape: `references/middleware.md`
- Routes, `_auth-*` guards, forms, shadcn, compiler, runtime layers: `references/app.md`

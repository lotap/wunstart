# Wunstart

A full-stack TypeScript starter kit: TanStack Start + Drizzle/Effect on Postgres, deployed to Cloudflare Workers, shipping a self-rolled auth core (sessions + JWT, anon identity, email verification) and a weight-based ban/rate-limit system.

The vocabulary below describes what the kit ships. **Replace it with your product's domain language as you build** — this file is the glossary agents read before writing feature code.

## Language

**Anon**:
An anonymous visitor identified by a signed JWS token. Materialises a DB row on first meaningful action and can convert to a User at sign-up.
_Avoid_: Guest

**User**:
An individual with an account. The atomic identity for login, auth, and ban scoring.
_Avoid_: Account

**Session**:
A server-side DB row authorizing a User, keyed by a rotating refresh token and backed by short-lived stateless access tokens.

**Refresh generation**:
A monotonic counter on a Session. Every authoritative rotation advances it; a short grace slot covers concurrent retries. Reuse of an older generation revokes the whole session family.

**Activity**:
An append-only security log row (success/failure, weight, IP, credential) written automatically by every Op.

**Weight**:
How strongly an Activity counts toward bans (e.g. a wrong password vs a rate-limit denial).

**Ban**:
A temporary block scoped to IP, credential, User, or Anon, created when a dimension's Activity weight crosses the threshold within the window.

**Op**:
An Effect-based business operation (`src/db/ops`) with automatic Activity logging, typed errors, and per-run Layers.

**Layer**:
An Effect dependency bundle (DB, auth secrets, email transport) supplied by the caller at each Op run.

**Archive**:
The active/archive table pair pattern: deletes move rows to the archive twin with FK redirection, preserving audit history forever.

**Email verification**:
Verify-before-create sign-up: a hashed 6-digit passcode authorizes user creation, so every User row is verified by construction.

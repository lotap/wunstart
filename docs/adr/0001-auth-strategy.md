# ADR 0001: Auth strategy, self-rolled with DB sessions + JWT hybrid

**Status**: Accepted  
**Date**: 2026-05-30  
**Updated**: 2026-08-08. Refresh tokens are now signed JWS values with a generation claim and rotation grace (see below)

## Context

Users must authenticate to access the app. The app needs session management, protected routes, and identity for every action. The built-in ban/rate-limit system also requires knowing the identity behind every request so abuse can be attributed and blocked.

Requirements:
- Email + password login (initially; future providers later)
- "Forgot password" flow (deferred but must be addable)
- Server-side session validation per request
- Stateless token for API calls (short-lived access token)
- Token refresh without re-authentication

## Decision

Hybrid approach:
- **Database-backed sessions** stored in a `sessions` table, keyed by a random token
- **Short-lived access token** (JWT, ~15 min TTL) cached in memory / local storage
- **Long-lived refresh token** (signed JWS, ~30 day sliding TTL) stored in `sessions` table

Access tokens are stateless JWTs for fast validation on data-fetching routes / server functions. The refresh token is validated against the DB to support revocation (e.g., on "log out everywhere" or an operator ban).

### Refresh rotation (added 2026-08-08)

Refresh tokens are signed JWS values carrying `sessionId`, a random nonce, an `exp`, and a signed `generation` claim. Every authoritative rotation:

- Advances the session's `refresh_generation` with a compare-and-swap update (guarded by the expected generation, current nonce hash, `revoked_at IS NULL`, and `expires_at > now()`), so two concurrent refreshes cannot both rotate the same token.
- Slides the session expiry by exactly 30 days (no absolute maximum lifetime); the JWS `exp`, the database `expires_at`, and the cookie expiry all derive from that one committed value.
- Stores a single bounded grace slot (immediately previous generation + encrypted successor nonce + 30s deadline). A replay of the previous-generation token within grace returns the already-created successor without rotating again (covers concurrent and response-loss retries).
- A valid token from an older generation than the immediately previous generation, or a previous-generation token used after grace, atomically revokes that session family (`revoked_at` set, grace slot cleared), records a `REFRESH_TOKEN_REUSE` security activity, and clears the auth cookies. Future-generation and invalid-signature tokens are rejected without revoking. The activities log is the audit record; no revocation reason is stored on the session row.
- Sign-out and sign-out-all archive the session(s); their end is recorded by the `AUTH_SIGN_OUT` / `AUTH_SIGN_OUT_ALL` activities.

### Accepted limitation

Access tokens are stateless and do not carry a session id, so refresh-family revocation does not immediately invalidate already-issued access tokens (up to 15 minutes). Reintroducing session-bound access-token checks for security-critical operations is a possible follow-up; it is not part of the current design.

## Rationale

### Why not a managed provider (Better Auth, WorkOS, Auth0)?

- Zero external dependencies or vendor lock-in; the kit works with nothing but Postgres.
- Full control over the session model, which directly supports the built-in shadow-ban/rate-limit system (special tokens or flags can be issued when needed).
- The ban system already needs hooks in the auth flow, so a provider would be an extra abstraction to work around.

### Why DB-backed sessions + JWT, not pure JWT?

Pure JWT (all state in the token, no DB lookup) makes revocation impossible. A banned user's token would remain valid until expiry. Backend session storage allows immediate enforcement of bans.

### Why not pure session-only (all DB lookups)?

Every route handler (e.g., a route loader or server function) would do a DB lookup for the session. Short-lived access tokens let high-frequency operations skip that round-trip while retaining revocation power via the refresh-flow check.

## Consequences

- Must implement password hashing (bcrypt/argon2), JWT signing/verification, CSRF protection.
- Forgot-password flow requires email infrastructure (deferred but non-trivial).
- A `sessions` table becomes a write-heavy table; needs index on refresh token and expiry cleanup.
- Switching to a provider later requires migrating existing sessions to the provider's format.
- Access token expiry (15 min) means users may hit brief re-auth on very long-lived pages unless refresh is automatic.

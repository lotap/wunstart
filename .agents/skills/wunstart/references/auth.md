# Auth wiring

Strategy, rotation, eviction posture, email-service and sudo-lease invariants are owned by the wunshot auth contract (`wunshot/references/auth.md`). This file is only the app-side wiring that upholds them.

## Sudo-gated actions

`useHasSudo()` gate + lazy `ReverifyDrawer` inside `AsyncBoundary` (see `remove-account.tsx`); the server fn's op rejects stale verification (`STALE_VERIFICATION` → re-verify first, see `remove-user.ts`). Lifecycle: provider holds the `sudoExpiresAt` timestamp as state (seeded from auth context) with a timer clearing it at expiry; a successful reverify sets a fresh timestamp via `setSudoExpiresAt`. Provider placement: see `references/app.md` routes.

## Sessions list, no per-session revoke

Settings page lists sessions with device (`formatUserAgent`) + geolocation (`formatLocation`) context; eviction UI is `signOutAll` only. Linted by `wunstart/no-single-session-revoke`.

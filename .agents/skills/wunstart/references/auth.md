# Auth wiring

Strategy, rotation, eviction posture, email-service and sudo-lease invariants are owned by the wunshot auth contract (`wunshot/references/auth.md`). This file is only the app-side wiring that upholds them.

## Sudo-gated actions

`useHasSudo()` gate + lazy `ReverifyDrawer` inside `AsyncBoundary` (see `remove-account.tsx`); the server fn's op rejects stale verification (`STALE_VERIFICATION` → re-verify first, see `remove-user.ts`). Lifecycle: provider holds the `sudoExpiresAt` timestamp as state (seeded from auth context) with a timer clearing it at expiry; a successful reverify sets a fresh timestamp via `setSudoExpiresAt`. Provider placement: see `references/app.md` routes.

Sign-in grants the lease because re-entering the same password seconds later adds no protection against someone who already knows it; requiring email verification for all sudo is deferred until a lost-old-email recovery path exists. The read-only email lookup stays sudo-gated without the live-session check so Settings does not pay a session lookup on every render. The password-change drawer defaults `signOutAllSessions` off: passwordless-first users often set a password for the first time, and default-on would sign them out of the current device.

## Sessions list, no per-session revoke

Settings page lists sessions with device + geolocation context — formatted op-side in `list-sessions.ts` (`formatUserAgent` from `_user-agent.ts`, `formatLocation` from `#/email/format-location.ts`), so the page never imports `#/email/…` itself (`email-layer-allowlist` would block it). Eviction UI is `signOutAll` only. Linted by `wunstart/no-single-session-revoke`.

The list is also the stale-device check: it covers every live session for the user, so an empty result makes `handleGetSessions` clear both auth cookies. The page then refreshes the router once, and the route guard redirects to sign-in. Both reverify operations also re-check the live session before minting, so an evicted device cannot extend the access token past its 15-minute lifetime. This closes the window where the access token outlives its session.

Deployment note: create the production Hyperdrive configuration with caching disabled (`wrangler hyperdrive create … --caching-disabled`, or `update <id> --caching-disabled`). Caching is a configuration setting, not a binding field, and it is on by default (60s + 15s stale); writes do not invalidate it, so a stale row can be served for up to ~75s. Session-liveness queries include `now()` and are uncacheable anyway — the stale-read risk is the user/anon queries (password hash, email, session IP history), which must not be cached. If a cached configuration is added later for public reads, keep auth/identity reads on the disabled one. Create the config with the flag, and re-apply the update if it is ever re-created. The drift risk is a re-created config without the flag or a later cached config; if a deploy pipeline is added, include the update there.

Sudo-gated mutations, user-keyed passcode requests, and both reverify ops that already ran `verifyLiveSession` use `runOpClearingDeadSession` (`middleware/_run-op.server.ts`): when that check fails with `INVALID_JWS` or `SESSION_NOT_FOUND`, the wrapper clears the same cookies and rethrows. No extra read is added — the op already paid for the check. `handleSignOutAll` deliberately keeps the cookies on failure so an evicted token cannot masquerade as a successful all-device sign-out.

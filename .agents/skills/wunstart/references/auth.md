# Auth strategy

Hybrid: DB-backed `sessions` rows keyed by random token + short-lived stateless access JWT (~15 min) + long-lived refresh JWS (~30d sliding, no absolute max). Access tokens skip DB round-trips; refresh validates against DB for revocation (ban, sign-out). Self-rolled, not a provider: zero vendor lock-in, ban hooks inline. Pure JWT rejected (no revocation); pure sessions rejected (DB lookup per fetch).

## Refresh rotation

Refresh JWS carries `sessionId`, random nonce, `exp`, signed `generation`. Every authoritative rotation: CAS-advances `refresh_generation` (guarded by expected generation + nonce hash + `revoked_at IS NULL` + `expires_at > now()`), slides expiry exactly 30 days (JWS `exp` + DB `expires_at` + cookie derive from the one committed value), keeps one bounded grace slot (prev generation + encrypted successor nonce + 30s). Replay of prev-gen within grace returns the already-created successor without rotating (covers concurrent / response-loss retries). Valid older-than-prev or expired-grace prev-gen use atomically revokes the family (`revoked_at`, grace cleared), records `REFRESH_TOKEN_REUSE`, clears cookies. Future-gen / bad-signature rejected without revoking. Sign-out / sign-out-all archive sessions; end recorded by `AUTH_SIGN_OUT` / `AUTH_SIGN_OUT_ALL`.

Accepted limitation: access tokens carry no session id, so family revocation leaves already-issued access tokens valid up to 15 min.

## Sudo-gated actions

`useHasSudo()` gate + lazy `ReverifyDrawer` inside `AsyncBoundary` (see `remove-account.tsx`); the server fn's op rejects stale verification (`STALE_VERIFICATION` → re-verify first, see `remove-user.ts`). Lifecycle: provider holds the `sudoExpiresAt` timestamp as state (seeded from auth context) with a timer clearing it at expiry; a successful reverify sets a fresh timestamp via `setSudoExpiresAt`. Provider placement: see `references/app.md` routes.

## Sessions list, no per-session revoke

Settings page lists sessions with device + geolocation context (detection tool). No user-facing single-session revoke: attacker with a stolen cookie could run a watcher loop auto-revoking the victim's fresh sessions, neutralizing `signOutAll`. Eviction tool is `signOutAll` (revokes all incl. attacker's; without credentials they can't return). Selective revocation exists only server-side: refresh-reuse detection (`revokeForReuse`) + owner email. Revisit per-session revoke alongside unauthenticated email-verified recovery, with remote-revocation email + per-user rate limit + revoke-others-only. Linted by `wunstart/no-single-session-revoke`.

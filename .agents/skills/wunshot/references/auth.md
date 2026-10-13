# Auth module contract

Auth is a whole module, not a collection of tables. Its models, ops, and invariants are owned here; app wiring (server fns, routes, cookies, middleware) upholds them — see the wunstart skill for that side.

## Composition

Models: `users`, `sessions` (+ `sessions---users` join queries), `anons`, `email-verifications`, `bans`, `activities`, `activities---bans`. Ops: `db/ops/auth/` (~20 fns + `email/` subdir).

## Strategy

Hybrid: DB-backed `sessions` rows keyed by random token + short-lived stateless access JWT (~15 min) + long-lived refresh JWS (~30d sliding, no absolute max). Access tokens skip DB round-trips; refresh validates against DB for revocation (ban, sign-out). Self-rolled, not a provider: zero vendor lock-in, ban hooks inline. Pure JWT rejected (no revocation); pure sessions rejected (DB lookup per fetch).

## Rotation

Refresh JWS carries `sessionId`, random nonce, `exp`, signed `generation` (see `refresh.ts`). Every authoritative rotation: CAS-advances `refresh_generation` (guarded by expected generation + nonce hash + `revoked_at IS NULL` + `expires_at > now()`), slides expiry exactly 30 days (JWS `exp` + DB `expires_at` + cookie derive from the one committed value — callers pass through, never recompute), keeps one bounded grace slot (prev generation + encrypted successor nonce + 30s). Replay of prev-gen within grace returns the already-created successor without rotating (covers concurrent / response-loss retries). Valid older-than-prev or expired-grace prev-gen use atomically revokes the family (`revoked_at`, grace cleared), records `REFRESH_TOKEN_REUSE`, clears cookies. Future-gen / bad-signature rejected without revoking. Sign-out / sign-out-all archive sessions; end recorded by `AUTH_SIGN_OUT` / `AUTH_SIGN_OUT_ALL`.

Accepted limitation: access tokens carry no session id, so family revocation leaves already-issued access tokens valid up to 15 min.

## External capabilities

Auth ops consume two host-provided capabilities as Effect service tags and never construct them:

- `EmailService` (`{send}`) — consumed by the six sending ops, layer provided per run by the caller. The tag currently lives host-side (`src/email/service.ts`), and the sending ops additionally import host render templates (`#/email/templates/…`); separately, `list-sessions.ts` (a read op, not a sender) imports `#/email/format-location.ts` — porting auth ops means porting or repointing those host imports. The layer (transports, fallback chain) stays host-owned permanently — it is runtime-bound (dev Mailpit, prod Workers `send_email`, optional fallback HTTP transport, bindings) and cannot move.
- `HashingStub` (Durable Object stub) — tag + layer factory live op-side (`db/ops/service-bindings.ts`); the `cloudflare:workers` import stays lazy so the module remains importable (type-only) outside the Workers runtime. This is the pattern to follow: tags travel with the module, implementations stay with the host.

Rule of thumb: if it touches the network, the runtime, or credentials, the implementation is host-owned; the tag is the contract.

## Invariants (db-side, wiring upholds)

- **Eviction is all-or-own.** `sign-out.ts` ends your own current session; `sign-out-all.ts` archives all of the user's sessions. No user-facing per-session revoke of other sessions: a stolen cookie lets an attacker run a watcher loop auto-revoking each fresh session the victim creates, so the victim never holds a session long enough to invoke `signOutAll`. `signOutAll` is safe because it is indiscriminate — it kills the attacker's session too, and without credentials they can't return. Selective revocation exists only server-side: refresh-reuse detection (`revokeForReuse` in `refresh.ts:198`, unexported) + owner-email flows. Revisit per-session revoke only alongside unauthenticated email-verified recovery, with remote-revocation email + per-user rate limit + revoke-others-only. Enforced app-side by `wunstart/no-single-session-revoke`.
- **Email enters ops only as a consumed service.** Sending ops (`request-passcode.ts`, `_sign-in.ts`, `email-change.ts`, `password-change.ts`, `password-sign-in.ts`, `refresh.ts`) do `const {send} = yield* EmailService`. Ops never construct or provide the live layer — the caller (server fn / middleware) provides it, so every send site is an explicit layer pass visible in review. Enforced app-side by `wunstart/email-layer-allowlist`.
- **Sudo is a 5-minute lease enforced op-side.** `SUDO_EXPIRATION_WINDOW` (`consts.ts`, 5 min); reverify mints a fresh access token carrying `sudoExpiresAt` (`password-reverify.ts`). Sudo-gated ops reject stale verification with `STALE_VERIFICATION` (`email-change.ts`, `remove-user.ts`, `password-change.ts`, `get-user-email.ts`) — the name alone grants nothing; authorization is review-enforced. Wiring (provider timestamp + expiry timer + reverify drawer) lives in the wunstart skill.
- **Denial weight routes to IP scope.** Rate-limit denials never persist `failedCredential` — pass the email as `meta: {credential}` for audit only. See `references/bans.md`. Enforced by `wunshot/no-failed-credential-in-denial`.

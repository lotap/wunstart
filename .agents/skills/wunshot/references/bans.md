# Bans + weight routing

Dimensions tracked per activity: IP, credential, user, anon, plus the archived user and anon forms. The `currentBansAndExcessiveActivities` prepared query (`db/models/activities---bans/queries.ts`, via `checkCurrentBansAndExcessiveActivities`) unions one arm per (source, scope) — active bans and windowed activity weight — so current bans and excessive activity arrive in one read inside the sliding `EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL`. Crossing `EXCESSIVE_ACTIVITIES_THRESHOLD` within the window creates a ban for that scope. All three consts live in `db/models/activities/consts.ts`.

The HTTP boundary rejects a request it cannot resolve to a client IP, so the ban pipeline only sees real addresses. `SYSTEM_OPS_IP` (`db/helpers/ip-sentinels.ts`) is the exception for system ops; no user request can carry it. The check compares networks rather than strings, so an IPv4-mapped spelling of the placeholder fails it too.

The IP scope keys on the client’s network, not the exact address: `IP_NETWORK_PREFIX` (`db/helpers/ip-network.ts`) sets the mask, and `bans.ip_network` / `activities.ip_network` store the result. IPv6 keys the `/64`, so a client rotating addresses inside its own allocation cannot reset the ban; IPv4 keys the exact address, which accepts the rotation an attacker with a block can do anyway rather than catching unrelated neighbours behind the same provider or office egress. The limiter uses the same key. `activities.ip_address` keeps the exact address for display and audit; `bans` carries no address, only the network, and the address behind a ban is recoverable through its `activityIds` / `activitiesArchiveIds`. `checkCurrentBansAndExcessiveActivities` converts the request address once, so ops keep passing `ipAddress`.

## Auth attempt allowance vs failure weight

Two layers bound credential abuse, and neither substitutes for the other. `models/auth-attempts/` counts unauthenticated credential presentations per target in a fixed window (values in its `consts.ts`): one atomic upsert per presentation, counted before any hashing. It bounds the Argon2 work a target can force — the ban pre-check is a read, so a concurrent burst can all pass it before any failure is logged and a ban exists. Failure weight remains the lockout and the penalty: crossing `EXCESSIVE_ACTIVITIES_THRESHOLD` sets the ban and its duration.

- **Rows and window.** An unauthenticated credential presentation upserts the network attempt row, and the credential attempt row unless the known-network escape applies. Each upsert counts successes as well as failures — the bound is hashing work, not failed guesses. The target is the network CIDR or the validated lowercased email, so every client behind one network shares the network allowance. The window is fixed, reset lazily on the next upsert, so a boundary can admit up to two allowances across one sliding span; a crash after the upsert leaves the count recorded (fail-closed).
- **Known-network escape.** The escape skips the credential row, so a known network stays usable while an attacker elsewhere fills the credential allowance. A presentation from a new network still shares that allowance and can be denied until the window rolls. A network denial returns before the credential upsert, so a blocked network cannot drain a claimed email’s allowance.
- **Denial path.** `authAttemptAllowanceFailure` (`db/ops/auth-attempt-allowance-error.ts`) returns an `AuthAttemptAllowanceError` at weight 0, so an allowance-exhausted denial cannot raise a total or move an expiry, though it can be the activity that lands a ban the window already earned. `runOp` classifies the error class, not its audit cause, and answers it as a direct 429 with the denial’s message; unlike a ban refusal, it does not charge the in-memory limiter, so the network’s other requests keep working while the row stays at its allowance until its window rolls. `extendMany` leaves `expires_at` alone when the delta is zero, so the expiry guarantee no longer depends on the denial running after the pre-check.
- **Send path.** The passcode request path is outside the allowance. Its own weight reaches the threshold after `PASSCODE_SENDS_PER_WINDOW` sends, so the next request is denied, and the reset window serialises repeats for one email and identity; a concurrent burst across distinct emails still passes the read-based pre-check, which this allowance would otherwise bound.

The daily system op `purgeAuthAttempts` deletes rows past `AUTH_ATTEMPT_RETENTION_WINDOW` (`models/auth-attempts/consts.ts`); the table has no archive twin, since the presentations it counts are already activities (see `references/tables-archive.md`). In development the boundary resolves every request to loopback, so one worktree shares a single network allowance: a QA loop that exhausts the window keeps getting the allowance denial message until the window rolls, and `delete from auth_attempts` is the reset.

## Weight routing

Omit `failedCredential` from the `ActivityError` payload on IP_ADDRESS and FAILED_CREDENTIAL denials. This routes weight exclusively to IP scope via the query's per-arm `isNotNull(targetColumn)` filter, so the credential ban expires at the end of `EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL` instead of being extended forever by an attacker cycling IPs.

- Use full-threshold weight (`rateAllowance: 1` → full threshold) so one denial from a new network during an active credential ban bans that network immediately. Tradeoff: a legit user on a new network during an attack gets that network banned too (one window each).
- Both denial factories (`rateLimitFailure`, `authAttemptAllowanceFailure`) omit `failedCredential` from their fields on purpose — passing it directly is a compile error (regression guard, plus `wunshot/no-failed-credential-in-denial` lint). Pass email as `meta: {credential}` for audit only.
- `logActivityAndHandleBans` only appends to / extends bans whose scope dimension is non-null on the activity's own row.

## Pre-check vs denial (the `failedCredential` split)

Pre-checks MAY carry the credential; denials MUST NOT. Same op, two calls:

```ts
const current = yield* checkCurrentBansAndExcessiveActivities({ipAddress, anonId, failedCredential: email})
if (current.filter((element) => element.scope !== 'FAILED_CREDENTIAL').length)
	return yield* rateLimitFailure({message: genericFailureOutputMessage, meta: {credential: email}, anonId})
```

Filter the scope your op guards (`!==` to enforce non-credential bans, `===` with a known-IP escape to enforce credential bans without locking out legit users on familiar networks). New code copies this shape; never place `failedCredential` in the denial.

The known-IP escape compares networks, not addresses: `selectUserWithKnownIpByEmail` masks both the request and each Session address with the family’s prefix (`IP_NETWORK_PREFIX`) before comparing, so an owner whose IPv6 interface identifier rotated still counts as known. The escape is owned by `skipsCredentialAttempt` (`db/ops/auth/_attempt-allowance.ts`), which reads `user.hasKnownIp`; never compare addresses yourself. The ban pre-check and `enforceAuthAttemptAllowance` both call it, so they cannot disagree about which presentations are exempt.

```ts
if (
	current.filter((element) => element.scope === 'FAILED_CREDENTIAL').length &&
	!skipsCredentialAttempt({user, ipAddress})
)
	return yield* rateLimitFailure({message: genericFailureOutputMessage, meta: {credential: email}, anonId})
```

## Ban ↔ activity references

`bans` stores `activityIds uuid[]` + `activitiesArchiveIds bigint[]`; queries use `ANY()` joins. No FK (Postgres can't FK array elements); archive cascade owns integrity. GIN index if volume demands. Single-target bans: `unique().nullsNotDistinct()` + `check(num_nonnulls() = 1)`.

Rejected: join table (N INSERTs per ban, unjustified for 1–60 rows), JSONB (unqueryable, no GIN on native types). Reconsider junction table past ~60 items per ban.

## Weight math

`rateAllowance → weight` via `allowRatePerWindow(n) = ceil(EXCESSIVE_ACTIVITIES_THRESHOLD / n)` (see `ops-error.ts`); omitted `rateAllowance` → `ACTIVITIES_BASELINE_WEIGHT`. `Infinity → weight 0` records the activity without adding weight: it cannot raise a total or move an expiry, though it still links to a ban as evidence and can be the activity that lands an already-earned ban. It is a policy choice, not a default: server faults always take it, while session, token, and stale-claim cases and their charged exceptions are owned by `auth.md`.

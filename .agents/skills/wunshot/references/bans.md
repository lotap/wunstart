# Bans + weight routing

Dimensions tracked per activity: IP, credential, user, anon. The `currentBansAndExcessiveActivities` prepared query (`db/models/activities---bans/queries.ts`, via `checkCurrentBansAndExcessiveActivities`) unions one arm per scope dimension over activities inside `EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL`. Crossing `EXCESSIVE_ACTIVITIES_THRESHOLD` within the window creates a ban for that scope. All three consts live in `db/models/activities/consts.ts`.

The HTTP boundary rejects a request it cannot resolve to a client IP, so the ban pipeline only sees real addresses. `SYSTEM_OPS_IP` (`db/helpers/ip-sentinels.ts`) is the exception for system ops; no user request can carry it. The check compares networks rather than strings, so an IPv4-mapped spelling of the placeholder fails it too.

The IP scope keys on the client’s network, not the exact address: `IP_NETWORK_PREFIX` (`db/helpers/ip-network.ts`) sets the mask, and `bans.ip_network` / `activities.ip_network` store the result. IPv6 keys the `/64`, so a client rotating addresses inside its own allocation cannot reset the ban; IPv4 keys the exact address, which accepts the rotation an attacker with a block can do anyway rather than catching unrelated neighbours behind the same provider or office egress. The limiter uses the same key. `activities.ip_address` keeps the exact address for display and audit; `bans` carries no address, only the network, and the address behind a ban is recoverable through its `activityIds` / `activitiesArchiveIds`. `checkCurrentBansAndExcessiveActivities` converts the request address once, so ops keep passing `ipAddress`.

## Attempt ceiling vs failure weight

Two layers bound credential abuse, and neither substitutes for the other. `models/auth-attempts/` counts credential presentations per target in a rolling window (values in its `consts.ts`): one atomic upsert per presentation, reserved before any hashing. It is the throughput bound — the ban pre-check is a read, so a concurrent burst can all pass it before any failure is logged and a ban exists. Failure weight remains the lockout and the penalty: crossing `EXCESSIVE_ACTIVITIES_THRESHOLD` sets the ban and its duration.

`attemptCeilingFailure` (`db/ops/rate-limit-error.ts`) is a `RateLimitError` at weight 0. A ceiling denial cannot create a ban, raise a total, or move an expiry: `extendMany` records the activity id as evidence and leaves `expires_at` alone when the delta is zero, so the guarantee no longer depends on the ceiling running after the pre-check. Ops reserve the network counter always and the credential counter unless the known-IP escape applies, so a third party on another network cannot exhaust the owner’s budget. The target is the network CIDR or the validated lowercased email; the window resets lazily on the next reservation, and a crash after the reservation consumes the attempt (fail-closed). The daily system op `purgeAuthAttempts` deletes counters past `AUTH_ATTEMPT_RETENTION_WINDOW` (`models/auth-attempts/consts.ts`); the counter has no archive twin, since every presentation it counts is already an activity (see `references/tables-archive.md`). In development the boundary resolves every request to loopback, so one worktree shares a single network counter: a QA loop that exhausts the window keeps getting the generic failure until the window rolls, and `delete from auth_attempts` is the reset.

## Weight routing

Omit `failedCredential` from the `ActivityError` payload on IP_ADDRESS and FAILED_CREDENTIAL rate-limit denials. This routes weight exclusively to IP scope via the query's per-arm `isNotNull(targetColumn)` filter, so the credential ban expires at the end of `EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL` instead of being extended forever by an attacker cycling IPs.

- Use full-threshold weight (`rateAllowance: 1` → full threshold) so one denial from a new IP during an active credential ban bans that IP immediately. Tradeoff: legit user on a new IP during attack gets IP-banned too (one window each).
- `rateLimitFailure` type omits `failedCredential` on purpose — passing it is a compile error (regression guard, plus `wunshot/no-failed-credential-in-denial` lint). Pass email as `meta: {credential}` for audit only.
- `logActivityAndHandleBans` only appends to / extends bans whose scope dimension is non-null on the activity's own row.

## Pre-check vs denial (the `failedCredential` split)

Pre-checks MAY carry the credential; denials MUST NOT. Same op, two calls:

```ts
const current = yield* checkCurrentBansAndExcessiveActivities({ipAddress, anonId, failedCredential: email})
if (current.filter((element) => element.scope !== 'FAILED_CREDENTIAL').length)
	return yield* rateLimitFailure({message: genericFailureOutputMessage, meta: {credential: email}, anonId})
```

Filter the scope your op guards (`!==` to enforce non-credential bans, `===` with a known-IP escape to enforce credential bans without locking out legit users on familiar networks). New code copies this shape; never place `failedCredential` in the denial.

The known-IP escape compares networks, not addresses: `selectUserWithKnownIpByEmail` masks both the request and each Session address with the family’s prefix (`IP_NETWORK_PREFIX`) before comparing, so an owner whose IPv6 interface identifier rotated still counts as known. The escape reads `user.hasKnownIp`; never compare addresses yourself.

```ts
if (
	current.filter((element) => element.scope === 'FAILED_CREDENTIAL').length &&
	(!user || !isClientIpAddress(ipAddress) || !user.hasKnownIp)
)
	return yield* rateLimitFailure({message: genericFailureOutputMessage, meta: {credential: email}, anonId})
```

## Ban ↔ activity references

`bans` stores `activityIds uuid[]` + `activitiesArchiveIds bigint[]`; queries use `ANY()` joins. No FK (Postgres can't FK array elements); archive cascade owns integrity. GIN index if volume demands. Single-target bans: `unique().nullsNotDistinct()` + `check(num_nonnulls() = 1)`.

Rejected: join table (N INSERTs per ban, unjustified for 1–60 rows), JSONB (unqueryable, no GIN on native types). Reconsider junction table past ~60 items per ban.

## Weight math

`rateAllowance → weight` via `allowRatePerWindow(n) = ceil(EXCESSIVE_ACTIVITIES_THRESHOLD / n)` (see `ops-error.ts`); omitted `rateAllowance` → `ACTIVITIES_BASELINE_WEIGHT`. `Infinity → weight 0` records the activity without ever feeding a ban. It is a policy choice, not a default: server faults always take it, while session, token, and stale-claim cases and their charged exceptions are owned by `auth.md`.

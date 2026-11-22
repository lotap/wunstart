# Bans + weight routing

Dimensions tracked per activity: IP, credential, user, anon. The `currentBansAndExcessiveActivities` prepared query (`db/models/activities---bans/queries.ts`, via `checkCurrentBansAndExcessiveActivities`) unions one arm per scope dimension over activities inside `EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL`. Crossing `EXCESSIVE_ACTIVITIES_THRESHOLD` within the window creates a ban for that scope. All three consts live in `db/models/activities/consts.ts`.

The HTTP boundary rejects a request it cannot resolve to a client IP, so the ban pipeline only sees real addresses. `SYSTEM_OPS_IP` (`db/helpers/ip-sentinels.ts`) is the exception for system ops; no user request can carry it.

The IP scope keys on the client’s network, not the exact address: `IP_NETWORK_PREFIX` (`db/helpers/ip-network.ts`) sets the mask, and `bans.ip_network` / `activities.ip_network` store the result. A client rotating addresses inside its own allocation therefore cannot reset the ban, and the limiter uses the same key. `activities.ip_address` keeps the exact address for display and audit; `bans` carries no address, only the network, and the address behind a ban is recoverable through its `activityIds` / `activitiesArchiveIds`. `checkCurrentBansAndExcessiveActivities` converts the request address once, so ops keep passing `ipAddress`.

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

The known-IP escape compares networks, not addresses: `selectUserWithKnownIpByEmail` masks both the request and each Session address with the family’s prefix (`IP_NETWORK_PREFIX`) before comparing, so an owner whose IPv6 interface identifier rotated still counts as known.

```ts
if (current.filter((element) => element.scope === 'FAILED_CREDENTIAL').length && !ipAddresses.includes(ipAddress))
	return yield* rateLimitFailure({message: genericFailureOutputMessage, meta: {credential: email}, anonId})
```

## Ban ↔ activity references

`bans` stores `activityIds uuid[]` + `activitiesArchiveIds bigint[]`; queries use `ANY()` joins. No FK (Postgres can't FK array elements); archive cascade owns integrity. GIN index if volume demands. Single-target bans: `unique().nullsNotDistinct()` + `check(num_nonnulls() = 1)`.

Rejected: join table (N INSERTs per ban, unjustified for 1–60 rows), JSONB (unqueryable, no GIN on native types). Reconsider junction table past ~60 items per ban.

## Weight math

`rateAllowance → weight` via `allowRatePerWindow(n) = ceil(EXCESSIVE_ACTIVITIES_THRESHOLD / n)` (see `ops-error.ts`); omitted `rateAllowance` → `ACTIVITIES_BASELINE_WEIGHT`. `Infinity → weight 0` records the activity without ever feeding a ban. It is a policy choice, not a default: server faults always take it, while session, token, and stale-claim cases and their charged exceptions are owned by `auth.md`.

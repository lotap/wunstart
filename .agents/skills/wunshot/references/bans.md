# Bans + weight routing

Dimensions tracked per activity: IP, credential, user, anon. The `currentBansAndExcessiveActivities` prepared query (`src/db/models/activities---bans/queries.ts`, via `checkCurrentBansAndExcessiveActivities`) unions one arm per scope dimension over activities inside `EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL`. Crossing `EXCESSIVE_ACTIVITIES_THRESHOLD` within the window creates a ban for that scope.

## Weight routing

Omit `failedCredential` from the `ActivityError` payload on IP_ADDRESS and FAILED_CREDENTIAL rate-limit denials. This routes weight exclusively to IP scope via the query's per-arm `isNotNull(targetColumn)` filter, so the credential ban expires naturally (~10 min) instead of being extended forever by an attacker cycling IPs.

- Use full-threshold weight (`rateAllowance: 1` → full threshold) so one denial from a new IP during an active credential ban bans that IP immediately. Tradeoff: legit user on a new IP during attack gets IP-banned too (~10 min each).
- `rateLimitFailure` type omits `failedCredential` on purpose — passing it is a compile error (regression guard, plus `wunshot/no-failed-credential-in-denial` lint). Pass email as `meta: {credential}` for audit only.
- `logActivityAndHandleBans` only appends to / extends bans whose scope dimension is non-null on the activity's own row.

## Ban ↔ activity references

`bans` stores `activityIds uuid[]` + `activitiesArchiveIds bigint[]`; queries use `ANY()` joins. No FK (Postgres can't FK array elements); archive cascade owns integrity. GIN index if volume demands.

Rejected: join table (N INSERTs per ban, unjustified for 1–60 rows), JSONB (unqueryable, no GIN on native types). Reconsider junction table past ~60 items per ban.

## Weight math

`rateAllowance → weight` via `allowRatePerWindow(n) = ceil(12600 / n)` (see `ops-error.ts`). `Infinity → weight 0` → server faults never feed ban thresholds.

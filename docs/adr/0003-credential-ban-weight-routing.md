# ADR 0003: Route rate-limit denial weight to IP scope, not credential scope

**Status**: Accepted  
**Date**: 2026-06-14

## Context

The auth rate-limiting system tracks activity weight per dimension (IP, credential, user, anon) via `GROUPING SETS` in the `excessiveActivities` view. When a dimension's total weight crosses `EXCESSIVE_ACTIVITIES_THRESHOLD` within a 10-minute window, a ban is created for that scope.

When a credential is already banned and an attacker tries from a new (unknown) IP, a denial at the FAILED_CREDENTIAL check that logs `failedCredential: email` with full-threshold weight feeds that weight back into the credential dimension, extending the credential ban exponentially. Each new attacker IP extends the ban further, effectively locking the legitimate owner out indefinitely as long as the attacker keeps cycling IPs.

The same problem exists at the IP_ADDRESS check: banned IPs logging with `failedCredential: email` can also extend credential bans indirectly.

## Decision

Omit `failedCredential` from the `ActivityError` payload on both the IP_ADDRESS and FAILED_CREDENTIAL RATE_LIMIT denials. This routes weight exclusively to the IP scope via the `excessiveActivities` view's `isNotNull(failedCredential)` filter. The credential ban expires naturally (~10 min).

Use full-threshold weight (`rateAllowance: 1` inside `rateLimitFailure`, resolving to a full `EXCESSIVE_ACTIVITIES_THRESHOLD`) rather than the WRONG_PASSWORD weight, so a single denial from a new IP during an active credential ban immediately bans that IP.

## Rationale

### Why omit `failedCredential` instead of other approaches

The `excessiveActivities` view partitions weight by `GROUPING SETS(ip_address, failed_credential, ...)`. Each dimension is independent. When `failedCredential` is null, the view's `isNotNull(failedCredential)` filter excludes that row from the credential grouping set, so weight flows to IP scope only. No schema, view, or query changes needed.

### Why full-threshold weight

The WRONG_PASSWORD weight would give an attacker 4 attempts per IP before it's banned. Full-threshold weight bans the IP on the first denial.

The tradeoff is that a legitimate user on a new IP during an active credential ban gets their IP immediately banned. This is acceptable because:

- The credential ban window is narrow (~10 min). The overlap between "legitimate user gets a new IP" and "credential is actively under attack" is small.
- The attacker gets 1 guess per IP instead of 4. For a distributed attack with 100 unique IPs, that's 100 guesses vs 400.
- Once the credential ban expires, the legitimate user can log in normally from any IP that isn't individually banned.

## Enforcement against regression

- `rateLimitFailure` no longer accepts `failedCredential`. Passing it is a compile error, so the omission cannot silently regress during refactors.
- `logActivityAndHandleBans` only appends to / extends bans whose scope dimension is non-null on the activity's own row — the same rule the grouping sets apply to row columns. Without this, credential-scope bans matched by denial lookups would get denial activities appended, inflating their referenced-weight totals and re-creating the indefinite lockout through the back door.
- Denials pass `meta: { credential: email }` so the attacked email remains visible for audit/debugging without participating in `GROUPING SETS` aggregation.

## Consequences

- A legitimate user who attempts login from a new IP during an active credential ban will have that IP immediately banned. They must wait for both the credential ban and their IP ban to expire (~10 min each).
- Attacker IPs are banned after a single denied attempt, shrinking the usable IP pool faster.

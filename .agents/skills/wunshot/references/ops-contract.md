# Ops contract

Ops are Effect-based business operations with automatic activity logging. Rigid skeleton:

```ts
import {Effect} from 'effect'
import {…} from 'db/models/…/queries.ts' // cross-module, via your import alias
import {…} from './_private-sibling.ts' // same-dir, always via ./

const genericFailureOutputMessage = '…' // anti-enumeration, per-file wording

const _signOut = Effect.fn('signOut')(function* ({token, ipAddress}: {…}) {
	const {nonce, sessionId} = yield* extractRefreshTokenPayload(token).pipe(Effect.mapError(…))
	const [session] = yield* sessionsQueries.select({id: sessionId})
	if (!session) return yield* opsFailure({failureCause: 'SESSION_NOT_FOUND', rateAllowance: 3})
	…
})
export const signOut = createOpsFn({fn: _signOut, label: 'AUTH_SIGN_OUT'})
```

Multi-statement mutations share one retried transaction (hashing stays outside it — see Rules). Queries take `tx` positionally, cascades in the options bag:

```ts
const db = yield* DB
return yield* retryTransientDb(
	db.transaction((tx) =>
		Effect.gen(function* () {
			yield* firstQuery({…}, tx)
			yield* archiveCascade({…}, {tx, extraData})
		}),
	),
)
```

## Rules

- Ops never construct layers: `yield* DB` / `HashingStub` / `EmailService` and let the consumer provide them at the call site (e.g. a `runOp({op, data, layers})` runner). Your app must provide whatever services your installed ops `yield*` — at minimum `dbLayer` (which provides `DB`), plus a layer for every other service (`HashingStub`, `EmailService`, …) and a runner that `Effect.provide`s them and maps control errors (`RateLimitError`, `AuthTokenError`) to transport responses at the boundary.
- `return yield* opsFailure({...})` is THE failure idiom (used throughout ops). `opsFailure()` returns an error instance; `TaggedErrorClass` instances are themselves effects. Not `Effect.fail`. `return yield* error` to re-raise a captured error.
- Failure sugar: `opsFailure({failureCause, rateAllowance, message, ...activity})` for one-offs; `createOpsFailure(Custom)({...})` when a classifier reacts by type. `rateAllowance: 1` spends the full threshold (one denial bans the scope immediately). Every file declares its own `genericFailureOutputMessage` wording (anti-enumeration — identical messages across flows leak which step failed).
- `label` is SCREAMING_SNAKE derived from the file's path under `ops/`: each directory level uppercased + filename (`auth/email/verify-passcode.ts` → `AUTH_EMAIL_VERIFY_PASSCODE`). `createSystemOpsFn` variant defaults `ipAddress` to `'0.0.0.0'`.
- `ipAddress` mandatory in every op's params, even when the body never destructures it (`createSystemOpsFn` injects the `'0.0.0.0'` default, so system ops omit it). Success return must be an object (`createOpsFn` requires `A extends object`; the `logging` override spreads into it). Params may include `anonId?`, `userId?`. Activity logging defaults on; `logOnSuccess?` / `logOnFailure?` (op options or per-call params) toggle each side.
- Three identity paths — easy to mix up, and getting them wrong corrupts audit data silently:
  | Path | When | Shape |
  | ---- | ---- | ----- |
  | `params.userId` | caller already knows the user | pass through; the activity FK points at the live row |
  | returned `logging: {…}` | identity created or retired mid-op | spread into the success object, e.g. `logging: {anonId: null, anonsArchiveId: retiredAnon.archiveId, userId}` — the row points at the archive, never the deleted live row |
  | `meta: {…}` | audit-only reference that may not exist | never a column: the FK would violate. Commented at each site: `meta, not the userId column: the referenced user may no longer exist, which would violate the FK` |
  Copy an existing op's `logging` shape, don't invent one.
- `createOpsFn`: per-invocation `CurrentBansAndExcessiveActivities` Ref, `tap`/`tapError`/`tapDefect` (weight 0 so defects never feed bans) → `logActivityAndHandleBans` in one retried tx of its own; log failure swallowed (never misreport committed mutation); interruptions untouched; `Effect.withSpan(label)`. Op bodies retry separately: `yield* retryTransientDb(db.transaction(...))` wraps the caller's mutation tx (see next bullet).
- Hashing (DO calls, ~700ms) runs BEFORE opening a tx, never inside (commented at the hashing call sites). Holding a tx across it stalls the pool and re-runs on every retry.
- Retry takes the effect as an argument, not `.pipe()`: `yield* retryTransientDb(db.transaction(...))`. Wraps the whole transaction, never individual statements (Postgres aborts on first error). `retryRollbackSafeDb` only for non-idempotent standalone statements.
- Side-effect emails wrapped in `Effect.ignore({log: true})` — delivery failure never fails the op.
- Error contract (`ops-error.ts`) is a `Schema.Struct`, not a base class: `OpsErrorSchema = {activity, message}`, `isOpsError = Schema.is`. Conforming `TaggedErrorClass` passes through, else wrapped `INTERNAL_ERROR` via `extractErrorProps` (never leak params; `EffectDrizzleQueryError.message` embeds params → `extractPgErrorMessage`). Declare a custom typed error only when a classifier must react by type (`OpsError`, `RateLimitError`, `AuthTokenError`). New conformer ~4 lines, no generic-file edits.
- `Effect.fn('camelCase')` mirrors the export name (`_removeUser` / `removeUser`); `Effect.gen` only for (a) `HashingStub` scoping, (b) transaction bodies, (c) isolating an `Effect.ignored` side effect. Plain arrow + `.pipe` for pure combinators. Shared constants live in the nearest `consts.ts` (op dir, e.g. `SUDO_EXPIRATION_WINDOW`, else the model's).
- `_`-prefixed helper ops are private.

Canonical examples: minimal op `db/ops/auth/remove-user.ts`; full op `db/ops/auth/password-sign-in.ts` (ban pre-check + tx + hashing-before-tx order + post-commit notification). Anything touching pre-checks, bans, or identity resolution: read `db/ops/_logging.ts` alongside a real op — the skill states outcomes, not that mechanism.

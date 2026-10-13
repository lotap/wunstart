# Adding a domain

`apiCalls` and `subscriptions` below are worked examples, not repo code: the domains are invented, every construct is a verified repo pattern. Sibling refs teach the mechanics; this file teaches the decisions, in order.

## Entity or event stream?

- **Append-only analytics** (logins, API calls): `createActiveLogTable` + `createArchiveLogTable` twins, `createArchiveManyFn` for batched expiry, and a retention system op modeled on `archive-old-activities` (batched `archiveManyOldByCutoff`, `catchTags` stop-conditions, `retryTransientDb`). Sketched below.
- **State with a lookup key** (feature flags, API keys): entity twins, a unique index on the key via the factories' third arg (`extraConfig: (t) => [uniqueIndex(...)]`), and a prepared select-by-key (statements are cached by `createPreparedQuery`, so the hot path never re-prepares).
- **Externally-owned state** (subscriptions, OAuth grants): entity twins + the provider's ID as plain `text()`, synced by webhook. Worked in the subscriptions example below.

## Stream sketch: `apiCalls` (analytics)

Log twins carry `id` + `timestamp` (no `createdAt`/`updatedAt`); active-only defaults stay active-only (cf. `weight`'s `default(1)`):

```ts
export const tableName = 'api_calls'

export const activeTable = createActiveLogTable(tableName, {
	userId: uuid().references(() => users.id),
	route: text().notNull(),
	statusCode: smallint().notNull().default(200),
})

export const archiveTable = createArchiveLogTable(`${tableName}_archive`, {
	userId: uuid().references(() => users.id),
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
	route: text().notNull(),
	statusCode: smallint().notNull(),
})
```

Expiry + retention per the decision-tree leaf above; if the stream FKs a core model, the core-extension step below still applies.

## Worked example: `subscriptions` (Stripe-style)

Five files in `db/models/subscriptions/`. Only the new-pattern lines are shown; the base shapes come from the recipe in `references/tables-archive.md`.

`schemas.ts` — lazy FK to users, provider ID with a unique index, status as free-form text (growing set, never an enum):

```ts
export const tableName = 'subscriptions'

const baseCols = {
	userId: uuid().references(() => users.id),
	providerSubscriptionId: text().notNull(),
	status: text().notNull(),
	currentPeriodEnd: timestamp(TIMESTAMPTZ_CONFIG).notNull(),
}

export const activeTable = createActiveTable(tableName, baseCols, (t) => [
	uniqueIndex('subscriptions_provider_id_unique').on(t.providerSubscriptionId),
])

export const archiveTable = createArchiveTable(`${tableName}_archive`, {
	...baseCols,
	usersArchiveId: bigint(ARCHIVE_ID_CONFIG).references(() => usersArchive.archiveId),
})
```

Archive-twin FK mirror rule (see the recipe in `references/tables-archive.md`): every `xId` FK gains an `xArchiveId` alongside the nullable original, so erasure/re-pointing can null the original while the archive row keeps attribution.

`validations.ts` — `RefinementsFor<typeof activeTable>` / `<typeof archiveTable>` overrides for what the primitives get wrong (same shape as `email-verifications`).

`queries.ts` — `labelPrefix = tableName`, `.prepare()` suffixed per query. Two domain queries beyond the recipe:

- `selectByProviderId` (the webhook's lookup — prepared, cached).
- `updateStatusIfMatches`: a compare-and-set `UPDATE … WHERE id = $id AND status = $expected`, modeled on `updatePasswordHashIfMatches`. Webhook handling must never read-then-blind-write: concurrent events for the same subscription race, so the select may be stale — the update itself must be the CAS.

`cascades.ts` — `createArchiveFn({selectFn, activeTable, archiveTable})` plus the per-user variant the core-extension step calls:

```ts
export const archiveByUser = createArchiveFn({
	selectFn: queries.selectByUser,
	activeTable,
	archiveTable,
})
```

(`deleteWhere` is an optional extra guard ANDed into the delete for columns the caller races on — e.g. `passcodeHash` in `email-verifications/cascades.ts:19`. Never guard on `id`: the machinery already deletes by selected-row ids.)

`consts.ts` — only if ops or other models import it (status strings stay inline otherwise; a shared `TRIAL_DAYS` belongs here, not in the op).

## Core-extension step: re-point the owner's cascades

Adding a domain that FKs a core model (here `users`) is half the job. The other half is editing that model's `cascades.ts` — otherwise the owner's delete fails loudly on the FK instead of cascading. Two cases, both visible in `users/cascades.ts`:

- **Child with its own per-user archival** (sessions pattern): call it with `extraData`, tolerating the empty case:
  ```ts
  subscriptionsCascades
  	.archiveByUser({userId: id}, {tx, extraData: {usersArchiveId: archiveId}})
  	.pipe(Effect.catchTag('ArchiveNotFoundError', () => Effect.void)),
  ```
- **Child that stays queryable** (activities/bans pattern): re-point in place, plus sweep its archive twin last so rows archived before the deletion keep attribution:
  ```ts
  tx.update(subscriptions).set({usersArchiveId: archiveId, userId: null}).where(eq(subscriptions.userId, id)),
  // …alongside the other sweeps:
  tx.update(subscriptionsArchive).set({usersArchiveId: archiveId, userId: null}).where(eq(subscriptionsArchive.userId, id)),
  ```

Subscriptions takes the first form (its rows archive with the user). The FK blocking the delete is the forcing function — see `Why archive pairs` in `references/tables-archive.md`.

## Webhook op: `syncSubscription`

Webhooks are system ops — no caller identity, provider-verified payload:

```ts
const genericFailureOutputMessage = 'Something went wrong. Please try again.'

const _syncSubscription = Effect.fn('syncSubscription')(function* ({providerSubscriptionId, status, currentPeriodEnd}: {…}) {
	const [sub] = yield* subscriptionsQueries.selectByProviderId({providerSubscriptionId})
	if (!sub) return yield* opsFailure({failureCause: 'SUBSCRIPTION_NOT_FOUND', message: genericFailureOutputMessage})
	// idempotency: unique provider ID makes redelivery a lookup hit;
	// CAS makes concurrent events converge instead of clobbering
	return yield* subscriptionsQueries.updateStatusIfMatches({id: sub.id, expected: sub.status, status, currentPeriodEnd})
})

export const syncSubscription = createSystemOpsFn({fn: _syncSubscription, label: 'SYSTEM_SYNC_SUBSCRIPTION'})
```

(`createSystemOpsFn` defaults `ipAddress` to `'0.0.0.0'`; see `archive-old-activities` for the full system-op shape including batched loops.)

## Cross-domain read: `subscriptions---users/`

Alphabetical `---` dir, queries + validations only; namespace and join rules per `Naming + imports` in `references/queries-validations.md`.

## Foreign-integration checklist

- Secrets in env or consumer layers only, never columns.
- Provider IDs as plain `text()` + unique index; provider enums as free-form text.
- Webhooks as system ops (`SYSTEM_` label), idempotent by unique external ID + CAS.
- Dates via DB `now()` (`defaultNow()` / `$onUpdate`), never provider clock math (ingesting the provider's absolute timestamps, e.g. `currentPeriodEnd`, is fine; don't compute durations from the app clock).
- No `relations()`; no enums for sets the provider can extend.

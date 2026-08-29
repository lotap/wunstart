# ADR 0002: Anon identity, row on first action

**Status**: Accepted (amended 2026-06-10)  
**Date**: 2026-06-10

An anonymous visitor carries a signed JWS (`{id, createdAt, iat, ipAddresses, registered}`)
in localStorage. The token is stateless until the first meaningful action, at which
point the server materialises an `anons` DB row and flips `registered: true`.
After materialisation, `activities` and `bans` tables carry FK references
to `anons.id`, so referential integrity is guaranteed for all downstream events.
At sign-up the row is archived via a standard cascade.

## Rationale

An anon's lifecycle is: anonymous → (maybe) materialise on first action → (maybe)
convert to User. Materialising the row on first action (not at sign-up, not at
token creation) balances three concerns:

- **Referential integrity**: once the `anons` row exists, all activities/bans
  with that `anonId` have a valid FK target. No loose UUIDs.
- **No write for sightseers**: visitors who bounce before any rate-limited action
  never touch the DB. Only visitors who perform a meaningful action generate a row.
- **Race-safe**: `ON CONFLICT DO UPDATE` handles concurrent requests both seeing
  `registered: false`. One INSERT succeeds; the other appends its IP address
  to the existing `ipAddresses` array via array concatenation (`||`).

## Token payload

The JWS carries `{id, createdAt, iat, ipAddresses, registered}`.
`createdAt` is the identity birth time, set once on first creation and preserved
through rotations. `iat` is token issuance time, updated on every rotation.
Two separate timestamps because they answer different questions: "when did this
anon first appear?" vs. "when was this specific token issued?".
The `registered` flag caches whether a DB row exists. It's not state, just a read
cache to avoid a query on every request, because the DB row is the source of truth.

## Schema

`anons` uses `createActiveTable` (not `createActiveLogTable`) because the row
exists before conversion. The active table stores `id`, `tokenCreatedAt`, and
`ipAddresses`, with no `userId` column. `anons_archive` uses `createArchiveTable`
and adds nullable `userId` (set at conversion, null before). `anonId` on
activities/bans is a real FK.

## Conversion archive cascade

At sign-up, within the transaction:

1. INSERT INTO `anons_archive` SELECT ... FROM `anons` WHERE `id = X` RETURNING `archiveId`
2. UPDATE activities SET `anonsArchiveId = X`, `anonId = null` WHERE `anonId = X`
3. UPDATE bans SET `anonsArchiveId = X`, `anonId = null` WHERE `anonId = X`
4. DELETE FROM `anons` WHERE `id = X`

This mirrors the guest archive pattern. `anonsArchiveId` allows single-table
lookup from activities/bans to the archived anon metadata.

# Anon identity

Anonymous visitor carries signed JWS `{id, createdAt, iat, ipAddresses, registered}` in localStorage. Stateless until first meaningful action, then server materialises an `anons` DB row and flips `registered: true`. After that `activities` / `bans` carry FK refs to `anons.id`. At sign-up the row archives via standard cascade. Say Anon, never Guest.

- `createdAt` = identity birth (set once, preserved); `iat` = token issuance (rotates). `registered` is a read-cache to skip a query, not state — DB row is source of truth.
- Race-safe: `ON CONFLICT DO UPDATE`; loser appends IPs via `||`.
- Schema: `anons` uses `createActiveTable` (row predates conversion): `id`, `tokenCreatedAt`, `ipAddresses`, no `userId`. `anons_archive` adds nullable `userId` (set at conversion).
- Conversion cascade (one tx): INSERT INTO `anons_archive` SELECT … RETURNING `archiveId` → UPDATE activities/bans SET `anonsArchiveId`, `anonId = null` → DELETE FROM `anons`. Mirrors guest pattern; single-table lookup from archive id.

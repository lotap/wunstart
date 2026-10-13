# Anon identity

Anonymous visitor carries signed JWS `{id, createdAt, iat, ipAddresses, registered}` in the `anon` cookie. Stateless until first meaningful action, then server materialises an `anons` DB row and flips `registered: true`. After that `activities` / `bans` carry FK refs to `anons.id`. At sign-up the row archives via standard cascade. Say Anon, never Guest.

- `createdAt` = identity birth (set once, preserved); `iat` = token issuance (rotates). `registered` is a read-cache to skip a query, not state — DB row is source of truth.
- Race-safe: `ON CONFLICT DO UPDATE`; loser appends IPs via `||`.
- Schema: `anons` uses `createActiveTable` (row predates conversion): `id`, `tokenCreatedAt`, `ipAddresses`, no `userId`. `anons_archive` adds nullable `userId` (set at conversion) + `usersArchiveId`.
- Conversion (`retireAnon`, in the same tx as user creation): registered anons go through the standard `anons` archive cascade with `extraData: {…, userId}`; unregistered go via `archiveInsert`. Activities/bans re-point to the archive row.

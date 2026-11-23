/**
 * The rolling window each counter covers. A row older than this starts a fresh
 * count on its next reservation; nothing resets on a successful presentation.
 */
export const AUTH_ATTEMPT_WINDOW = '10 minutes'

/**
 * Presentations allowed per target per window. `credential` follows the email a
 * presentation claimed; `network` follows the client network. Both are a
 * throughput bound, not a lockout — the failure-weighted bans still decide who
 * is locked out and for how long
 */
export const AUTH_ATTEMPT_ALLOWANCE = {credential: 12, network: 30} as const

/**
 * How long a counter row survives after its window closes. Long enough to read a
 * just-closed window while investigating; one row per key, so the sweep only has
 * to stop the key set growing, not trim rows within a key
 */
export const AUTH_ATTEMPT_RETENTION_WINDOW = '1 day'

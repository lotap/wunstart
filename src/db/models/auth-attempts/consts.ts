/**
 * The fixed window each row covers: anchored at the first presentation that
 * opens it, then reset lazily on the first upsert after it expires, so one
 * sliding span can see up to two allowances across a boundary. Nothing resets on
 * a successful presentation.
 */
export const AUTH_ATTEMPT_WINDOW = '10 minutes'

/**
 * Presentations allowed per target per window. `credential` follows the email a
 * presentation claimed; `network` follows the client network. Every
 * presentation counts, success included. The bound is
 * hashing work rather than failed guesses. The network allowance is sized to industry
 * standards above the per-isolate auth lane, so it is the durable backstop
 * rather than the first cap. Both are a throughput bound, not a lockout — the
 * failure-weighted bans still decide who is locked out and for how long
 */
export const AUTH_ATTEMPT_ALLOWANCE = {credential: 12, network: 60} as const

/**
 * How long an auth attempt row survives after its window closes. Long enough to read a
 * just-closed window while investigating; one row per key, so the sweep only has
 * to stop the key set growing, not trim rows within a key
 */
export const AUTH_ATTEMPT_RETENTION_WINDOW = '1 day'

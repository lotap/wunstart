/**
 * How long a passcode row lives after it is minted or reset. The column default
 * and the reset path both derive from it, so a change reaches both
 */
export const PASSCODE_TTL_MINUTES = 15

/** The same lifespan as a Postgres interval, for statements that bind it */
export const PASSCODE_TTL = `${PASSCODE_TTL_MINUTES} minutes`

/**
 * A reset needs the current window to be at least a minute old, so the row has to
 * expire later than this. Derived from the lifespan: naming it separately would
 * let the two drift
 */
export const PASSCODE_RESET_FLOOR = `${PASSCODE_TTL_MINUTES - 1} minutes`

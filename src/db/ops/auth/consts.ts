export const SUDO_EXPIRATION_WINDOW = 5 * 60 * 1000

/** Lifetime of an access token. */
export const ACCESS_TOKEN_EXPIRATION_MILLISECONDS = 15 * 60 * 1000

/** Wrong-code attempts before the verification row retires. */
export const PASSCODE_MAX_ATTEMPTS = 4

/** Passcode sends per activity window before the send weight reaches the threshold. */
export const PASSCODE_SENDS_PER_WINDOW = 6

/** Lifetime of the successor nonce minted by a refresh rotation. */
export const REFRESH_GRACE_SECONDS = 30

/** Anon cookie lifetime; the browser drops the identity after it. */
export const ANON_COOKIE_WEEKS = 8

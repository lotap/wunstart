/**
 * Copy emitted only by the email passcode flow.
 *
 * Promote a message to `../../messages.ts` when a second auth scope emits it.
 */

/** The verification row is burned, expired, or superseded. */
export const INVALID_PASSCODE_MESSAGE = 'That code is no longer valid. Request a fresh one.'

/** The verification row reached the wrong-code attempt cap. */
export const TOO_MANY_PASSCODE_ATTEMPTS_MESSAGE =
	'Too many tries. Request a fresh code to start over.'

/** The submitted passcode did not match. */
export const WRONG_PASSCODE_MESSAGE = 'That code isn’t right. Double-check it and try again.'

/** A reset was requested inside the previous code’s cooldown. */
export const PASSCODE_TOO_SOON_MESSAGE =
	'A new code isn’t ready for that address yet. Give it a moment and try again.'

/** The passcode email could not be sent. */
export const PASSCODE_SEND_FAILED_MESSAGE = 'We couldn’t send your code. Give it another go.'

/** Neutral verify-passcode failure shared by the flow’s sensitive branches. */
export const EMAIL_VERIFY_GENERIC_FAILURE_MESSAGE =
	'Something went wrong. Double-check your details and try again.'

/** Neutral request-passcode failure shared by the flow’s sensitive branches. */
export const EMAIL_REQUEST_GENERIC_FAILURE_MESSAGE =
	'Something went wrong. Please try again in a moment.'

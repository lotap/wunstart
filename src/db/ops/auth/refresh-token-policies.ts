import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/** Audit cause by refresh-JWS verdict; nonce checks have their own cause map. */
export const REFRESH_FAILURE_CAUSES = {
	'expired': 'EXPIRED_JWS',
	'invalid': 'INVALID_JWS',
	'unknown-kid': 'UNKNOWN_KID',
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, string>

/** Why a verified refresh JWS cannot resolve a live session. */
export type RefreshSessionInvalidReason = keyof typeof REFRESH_FAILURE_CAUSES

/**
 * `grace-unreadable` is the stored grace JWE failing to decrypt/parse;
 * `grace-unknown-kid` is a header naming a `kid` dropped from the secret map.
 */
export type RefreshNonceCheck = 'match' | 'mismatch' | 'grace-unreadable' | 'grace-unknown-kid'

/** Audit cause by nonce-check result for terminal contexts. */
export const REFRESH_NONCE_CHECK_CAUSES = {
	'mismatch': 'WRONG_NONCE',
	'grace-unreadable': 'GRACE_UNREADABLE',
	'grace-unknown-kid': 'UNKNOWN_KID',
} as const satisfies Record<Exclude<RefreshNonceCheck, 'match'>, string>

/** Refresh-entry policy; terminal contexts must read the cause maps, not spread this row. */
export const REFRESH_TOKEN_FAILURES = {
	'expired': {failureCause: REFRESH_FAILURE_CAUSES.expired, rateAllowance: Infinity},
	'invalid': {failureCause: REFRESH_FAILURE_CAUSES.invalid, rateAllowance: 4},
	'unknown-kid': {
		failureCause: REFRESH_FAILURE_CAUSES['unknown-kid'],
		rateAllowance: Infinity,
	},
} as const satisfies Record<RefreshSessionInvalidReason, TokenFailurePolicy>

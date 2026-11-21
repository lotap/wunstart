import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Audit cause by verdict. This is the shared vocabulary: sign-out,
 * sign-out-all, and the live-session check read only this map and charge no
 * weight.
 */
export const REFRESH_FAILURE_CAUSES = {
	'expired': 'EXPIRED_JWS',
	'invalid': 'INVALID_JWS',
	'unknown-kid': 'UNKNOWN_KID',
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, string>

/** Why a verified refresh JWS cannot resolve a live session. */
export type RefreshSessionInvalidReason = keyof typeof REFRESH_FAILURE_CAUSES

/**
 * Failure policy for the unauthenticated refresh entry, built from
 * {@link REFRESH_FAILURE_CAUSES}. The allowance is specific to that entry;
 * terminal contexts must read the cause map rather than spread this row, or a
 * stale sign-out would start accruing bans.
 */
export const REFRESH_TOKEN_FAILURES = {
	'expired': {failureCause: REFRESH_FAILURE_CAUSES.expired, rateAllowance: Infinity},
	'invalid': {failureCause: REFRESH_FAILURE_CAUSES.invalid, rateAllowance: 4},
	'unknown-kid': {
		failureCause: REFRESH_FAILURE_CAUSES['unknown-kid'],
		rateAllowance: Infinity,
	},
} as const satisfies Record<RefreshSessionInvalidReason, TokenFailurePolicy>

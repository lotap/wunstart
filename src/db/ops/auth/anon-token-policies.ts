import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Token failure policy for Anon JWS. Anon tokens carry no `exp` claim, so the
 * expired row is unreachable today and deliberately matches the invalid charge;
 * adding an expiry policy must change this map rather than a hidden fall-through.
 */
export const ANON_TOKEN_FAILURES = {
	'expired': {failureCause: 'INVALID_JWS', rateAllowance: 3},
	'invalid': {failureCause: 'INVALID_JWS', rateAllowance: 3},
	'unknown-kid': {failureCause: 'UNKNOWN_KID', rateAllowance: Infinity},
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, TokenFailurePolicy>

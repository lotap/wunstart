import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Anon-JWS policy. Anon tokens have no `exp`, so the expired row is unreachable
 * and matches the invalid charge; adding expiry must change this map, not fall
 * through silently.
 */
export const ANON_TOKEN_FAILURES = {
	'expired': {failureCause: 'INVALID_JWS', rateAllowance: 3},
	'invalid': {failureCause: 'INVALID_JWS', rateAllowance: 3},
	'unknown-kid': {failureCause: 'UNKNOWN_KID', rateAllowance: Infinity},
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, TokenFailurePolicy>

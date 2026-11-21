import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Access-JWE policy. Expired and rotated-out tokens fall through; only a
 * known-kid invalid JWE is a failed credential presentation.
 */
export const ACCESS_TOKEN_FAILURES = {
	'expired': {failureCause: 'EXPIRED_JWE', rateAllowance: Infinity},
	'invalid': {failureCause: 'INVALID_JWE', rateAllowance: 3},
	'unknown-kid': {failureCause: 'UNKNOWN_KID', rateAllowance: Infinity},
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, TokenFailurePolicy>

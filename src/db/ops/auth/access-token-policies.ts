import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Token failure policy for access JWEs. Expired and rotated-out tokens are
 * ordinary fall-through states; only a known-kid invalid JWE is a failed
 * credential presentation and carries ban weight.
 */
export const ACCESS_TOKEN_FAILURES = {
	'expired': {failureCause: 'EXPIRED_JWE', rateAllowance: Infinity},
	'invalid': {failureCause: 'INVALID_JWE', rateAllowance: 3},
	'unknown-kid': {failureCause: 'UNKNOWN_KID', rateAllowance: Infinity},
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, TokenFailurePolicy>

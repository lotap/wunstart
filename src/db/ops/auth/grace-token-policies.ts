import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Grace replay failure policy. The grace JWE carries no `exp`, so the expired
 * row is unreachable today and deliberately matches the corrupt/unreadable
 * state; an unknown kid is the rotated-out state with the cause preserved.
 * Both remain weight 0.
 */
export const GRACE_REPLAY_FAILURES = {
	'expired': {failureCause: 'WRONG_NONCE', rateAllowance: Infinity},
	'invalid': {failureCause: 'WRONG_NONCE', rateAllowance: Infinity},
	'unknown-kid': {failureCause: 'UNKNOWN_KID', rateAllowance: Infinity},
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, TokenFailurePolicy>

/**
 * Grace decode verdict to nonce-check reason. The grace JWE carries no `exp`,
 * so the expired row is unreachable today and deliberately matches the corrupt
 * or unreadable state.
 */
export const GRACE_NONCE_CHECK_FAILURES = {
	'expired': 'grace-unreadable',
	'invalid': 'grace-unreadable',
	'unknown-kid': 'grace-unknown-kid',
} as const satisfies Record<
	Exclude<JwtFailureVerdict, 'hkdf'>,
	'grace-unreadable' | 'grace-unknown-kid'
>

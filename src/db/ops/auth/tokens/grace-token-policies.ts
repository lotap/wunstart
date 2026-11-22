import type {JwtFailureVerdict, TokenFailurePolicy} from './_jwt-utils.ts'

/**
 * Grace replay policy. The grace JWE has no `exp`, so `expired` is unreachable
 * and matches the unreadable state; `unknown-kid` is the rotated-out state.
 */
export const GRACE_REPLAY_FAILURES = {
	'expired': {failureCause: 'GRACE_UNREADABLE', rateAllowance: Infinity},
	'invalid': {failureCause: 'GRACE_UNREADABLE', rateAllowance: Infinity},
	'unknown-kid': {failureCause: 'UNKNOWN_KID', rateAllowance: Infinity},
} as const satisfies Record<Exclude<JwtFailureVerdict, 'hkdf'>, TokenFailurePolicy>

/** Grace-decode verdict to nonce-check reason; `expired` is unreachable and matches the unreadable state. */
export const GRACE_NONCE_CHECK_FAILURES = {
	'expired': 'grace-unreadable',
	'invalid': 'grace-unreadable',
	'unknown-kid': 'grace-unknown-kid',
} as const satisfies Record<
	Exclude<JwtFailureVerdict, 'hkdf'>,
	'grace-unreadable' | 'grace-unknown-kid'
>

import {Schema} from 'effect'

import {createOpsFailure, OpsErrorSchema, type OpsFailureFields} from '#/db/ops/ops-error.ts'

/**
 * Framework control error: the caller was rejected by the auth attempt
 * allowance. The class is the control signal: `runOp` answers it as a direct
 * 429 carrying the failure's message and never charges the in-memory limiter.
 * It is not a `RateLimitError`, which is reserved for ban refusals.
 */
export class AuthAttemptAllowanceError extends Schema.TaggedError<
	AuthAttemptAllowanceError,
	{readonly brand: unique symbol}
>()('AuthAttemptAllowanceError', OpsErrorSchema) {}

/**
 * Constructs the auth-attempt-allowance rejection: a presentation beyond the
 * fixed-window allowance for its target.
 *
 * Weight 0 (`rateAllowance: Infinity`) is deliberate: the allowance bounds
 * pre-hash work and is audited, while the failure-weighted ban pipeline remains
 * the lockout and the penalty, so the denial cannot raise a total or move an
 * expiry. `failureCause` is audit text; {@link AuthAttemptAllowanceError} is
 * what `runOp` classifies.
 *
 * `failedCredential` is deliberately not accepted, for the same reason as
 * `rateLimitFailure` (`rate-limit-error.ts`): a denial must never feed weight
 * back into the credential grouping set. Pass an audit-only reference through
 * `meta` instead.
 */
export const authAttemptAllowanceFailure = (
	fields: Omit<OpsFailureFields, 'failureCause' | 'rateAllowance' | 'failedCredential'>,
) =>
	createOpsFailure(AuthAttemptAllowanceError)({
		...fields,
		failureCause: 'AUTH_ATTEMPT_ALLOWANCE',
		rateAllowance: Infinity,
	})

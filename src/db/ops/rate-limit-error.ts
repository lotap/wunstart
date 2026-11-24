import {Schema} from 'effect'

import {createOpsFailure, OpsErrorSchema, type OpsFailureFields} from '#/db/ops/ops-error.ts'

/**
 * Framework control error: the caller was rejected by ban/rate-limit logic.
 * The class tag is the control signal: `runOp` forwards a ban refusal to the
 * rate limiter and returns an attempt-allowance failure as a direct 429. The
 * persisted audit row keeps its `failureCause` by convention. Construct via
 * {@link rateLimitFailure} or {@link authAttemptAllowanceFailure}.
 */
export class RateLimitError extends Schema.TaggedError<
	RateLimitError,
	{readonly brand: unique symbol}
>()('RateLimitError', OpsErrorSchema) {}

/**
 * Constructs the framework's rate-limit rejection: standardizes the audit
 * cause (`'RATE_LIMIT'`) and the ban-threshold weight. The message stays
 * caller-supplied (ops surface their own safe phrasing).
 *
 * `failedCredential` is deliberately not accepted: a RATE_LIMIT denial must
 * never carry a credential into its persisted activity, or every denial feeds
 * weight back into the FAILED_CREDENTIAL grouping set and lets an attacker
 * cycling IPs extend a credential ban indefinitely. Pass the attacked email
 * through `meta: {credential}` instead, recorded for audit and invisible to
 * aggregation. The compile-time omission makes regressing to a
 * credential-carrying payload a type error.
 */
export const rateLimitFailure = (
	fields: Omit<OpsFailureFields, 'failureCause' | 'rateAllowance' | 'failedCredential'>,
) => createOpsFailure(RateLimitError)({...fields, failureCause: 'RATE_LIMIT', rateAllowance: 1})

/**
 * Constructs the auth-attempt-allowance rejection: a presentation beyond the
 * fixed-window allowance for its target. It is a {@link RateLimitError} so the
 * boundary answers the same way as any other denial, but at weight 0: the
 * allowance bounds pre-hash work and is audited, while the failure-weighted ban
 * pipeline remains the lockout and the penalty. It is a {@link RateLimitError}
 * so `runOp` returns it as a direct 429 with this message; unlike a ban refusal,
 * it does not charge the in-memory limiter, so the network's other requests keep
 * working. It omits `failedCredential` for the same reason as
 * {@link rateLimitFailure}: a denial must never feed weight back into the
 * credential grouping set.
 */
export const authAttemptAllowanceFailure = (
	fields: Omit<OpsFailureFields, 'failureCause' | 'rateAllowance' | 'failedCredential'>,
) =>
	createOpsFailure(RateLimitError)({
		...fields,
		failureCause: 'AUTH_ATTEMPT_ALLOWANCE',
		rateAllowance: Infinity,
	})

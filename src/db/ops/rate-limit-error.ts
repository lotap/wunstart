import {Schema} from 'effect'

import {createOpsFailure, OpsErrorSchema, type OpsFailureFields} from '#/db/ops/ops-error.ts'

/**
 * Framework control error: the caller was rejected by ban/rate-limit logic.
 * The class tag is the control signal (`runOp` forwards it to the rate
 * limiter); the persisted audit row keeps `failureCause: 'RATE_LIMIT'` by
 * convention. Construct via {@link rateLimitFailure} to keep them aligned.
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
 * Constructs the attempt-ceiling rejection: a presentation beyond the rolling
 * allowance for its target. It is a {@link RateLimitError} so the boundary
 * answers the same way as any other denial, but at weight 0: the ceiling bounds
 * throughput and is audited, while the failure-weighted ban pipeline remains the
 * lockout and the penalty. It omits `failedCredential` for the same reason as
 * {@link rateLimitFailure}: a denial must never feed weight back into the
 * credential grouping set.
 */
export const attemptCeilingFailure = (
	fields: Omit<OpsFailureFields, 'failureCause' | 'rateAllowance' | 'failedCredential'>,
) =>
	createOpsFailure(RateLimitError)({
		...fields,
		failureCause: 'ATTEMPT_CEILING',
		rateAllowance: Infinity,
	})

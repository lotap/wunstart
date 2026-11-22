import {Schema} from 'effect'

import {createOpsFailure, OpsErrorSchema} from '../../ops-error.ts'

/**
 * A presented auth token was definitively rejected as unusable.
 *
 * The class tag is the only classification signal, so there is no failureCause literal
 * union to tabulate when new invalid-token paths are added.
 */
export class AuthTokenError extends Schema.TaggedError<
	AuthTokenError,
	{readonly brand: unique symbol}
>()('AuthTokenError', OpsErrorSchema) {}

/** Sugar for constructing AuthTokenErrors in ops functions */
export const authTokenFailure = createOpsFailure(AuthTokenError)

/**
 * The refresh session behind an authenticated request cannot vouch for the
 * access token: its JWS is invalid or expired, its Session row is gone, or the
 * row belongs to another user. Callers catch this by class to clear the dead
 * cookie pair; the individual `failureCause` remains audit text.
 */
export class DeadSessionError extends Schema.TaggedError<
	DeadSessionError,
	{readonly brand: unique symbol}
>()('DeadSessionError', OpsErrorSchema) {}

/** Sugar for constructing DeadSessionErrors in ops functions */
export const deadSessionFailure = createOpsFailure(DeadSessionError)

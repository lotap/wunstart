import {Schema} from 'effect'

import {createOpsFailure, OpsErrorSchema} from '../ops-error.ts'

/**
 * A presented auth token was definitively rejected as unusable.
 *
 * The class tag is the only classification signal, so there is no failureCause literal
 * union to tabulate when new invalid-token paths are added.
 */
export class AuthTokenError extends Schema.TaggedErrorClass<AuthTokenError>()(
	'AuthTokenError',
	OpsErrorSchema,
) {}

/** Sugar for constructing AuthTokenErrors in ops functions */
export const authTokenFailure = createOpsFailure(AuthTokenError)

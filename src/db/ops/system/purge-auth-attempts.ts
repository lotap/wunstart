import {Effect} from 'effect'

import {AUTH_ATTEMPT_RETENTION_WINDOW} from '#/db/models/auth-attempts/consts.ts'
import * as authAttemptsQueries from '#/db/models/auth-attempts/queries.ts'
import {createSystemOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'

const _purgeAuthAttempts = Effect.fn('purgeAuthAttempts')(function* () {
	const deletedRows = yield* authAttemptsQueries
		.deleteByCutoff({cutoff: AUTH_ATTEMPT_RETENTION_WINDOW})
		.pipe(retryTransientDb)

	return {deletedCount: deletedRows.length}
})

/**
 * Deletes attempt counters past {@link AUTH_ATTEMPT_RETENTION_WINDOW}. The rows
 * reset lazily on their next reservation, so an expired row is dead weight; the
 * daily cron keeps the table from accumulating one per (scope, target) ever
 * seen.
 */
export const purgeAuthAttempts = createSystemOpsFn({
	fn: _purgeAuthAttempts,
	label: 'SYSTEM_PURGE_AUTH_ATTEMPTS',
})

import {Effect} from 'effect'

import {AUTH_ATTEMPT_RETENTION_WINDOW} from '#/db/models/auth-attempts/consts.ts'
import * as authAttemptsQueries from '#/db/models/auth-attempts/queries.ts'
import {createSystemOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'

/**
 * Rows deleted per statement. Bounds the transaction and the `RETURNING` buffer,
 * so a nightly run cannot grow with the backlog; the same convention as the
 * activity archive.
 */
const PURGE_BATCH_SIZE = 500

const _purgeAuthAttempts = Effect.fn('purgeAuthAttempts')(function* () {
	let deletedCount = 0
	let remaining = true

	while (remaining) {
		const deletedRows = yield* authAttemptsQueries
			.deleteByCutoff({cutoff: AUTH_ATTEMPT_RETENTION_WINDOW, limit: PURGE_BATCH_SIZE})
			.pipe(retryTransientDb)

		deletedCount += deletedRows.length
		/** A short batch means nothing past the cutoff remains */
		remaining = deletedRows.length === PURGE_BATCH_SIZE
	}

	return {deletedCount}
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

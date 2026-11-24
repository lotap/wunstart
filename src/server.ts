import handler from '@tanstack/react-start/server-entry'
import {Cause, Effect, Exit} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {archiveOldActivities} from '#/db/ops/system/archive-old-activities.ts'
import {purgeAuthAttempts} from '#/db/ops/system/purge-auth-attempts.ts'

export {AuthHasher} from './durable-objects/auth-hasher.ts'

/**
 * Runs a scheduled job and renders a failure as its cause, so one job's failure
 * cannot interrupt the other.
 */
const captureFailure = <A, E, R>(job: Effect.Effect<A, E, R>) =>
	job.pipe(
		Effect.exit,
		Effect.map((exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : null)),
	)

/**
 * Daily cron (06:30 UTC): archives activities past the retention window and
 * deletes attempt rows past their retention window.
 *
 * The jobs are independent — unrelated tables, and separate entries on a VPS —
 * so each runs to completion even when the other fails. The run still reports
 * failure once both have finished, with the causes attached.
 */
const scheduled = async () => {
	const outcomes = await Effect.runPromise(
		// Cron entry point: the DB layer is provided once for both runs.
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.all([captureFailure(archiveOldActivities({})), captureFailure(purgeAuthAttempts({}))], {
			concurrency: 'unbounded',
		}).pipe(Effect.provide(dbLayer)),
	)

	const failures = outcomes.filter((cause) => cause !== null)

	if (failures.length)
		throw new Error(`scheduled run failed (${failures.length} job(s)):\n${failures.join('\n')}`)
}

export default {fetch: handler.fetch, scheduled}

import {Effect} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {archiveOldActivities} from '#/db/ops/system/archive-old-activities.ts'

/**
 * Standalone runner for the activities archive job.
 *
 * Cloudflare Workers runs this via the `scheduled` handler (src/server.ts).
 * Other platforms (e.g. a VPS system cron) run this file directly:
 *
 *   bun run archive-old-activities
 *
 * Requires DATABASE_URL in the environment (see the `archive-old-activities` script in package.json).
 */
async function main() {
	try {
		// Cron entry point: the DB layer is provided once per run.
		// `Effect.scoped` closes the layer's scope after the run (success or failure),
		// which runs the pool's release handler (`pool.end()`), so no connections linger.
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		await Effect.runPromise(archiveOldActivities({}).pipe(Effect.provide(dbLayer), Effect.scoped))
	} catch (error) {
		console.error(error)
		process.exitCode = 1
	}
}

void main()

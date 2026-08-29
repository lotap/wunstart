import {Effect} from 'effect'

import {dbLayer} from '#/db/index.ts'
import {archiveOldActivities} from '#/db/ops/system/archive-old-activities.ts'

/**
 * Standalone runner for the activities archive job.
 *
 * Cloudflare Workers runs this via the `scheduled` handler (src/server.ts).
 * Other platforms (e.g. a VPS system cron) run this file directly:
 *
 *   bun --bun run src/scripts/archive-old-activities.ts
 *
 * Requires DATABASE_URL in the environment (see the `archive-activities` script in package.json).
 */
async function main() {
	try {
		// `Effect.scoped` closes the layer's scope after the run (success or failure),
		// which runs the pool's release handler (`pool.end()`), so no connections linger.
		await Effect.runPromise(archiveOldActivities({}).pipe(Effect.provide(dbLayer), Effect.scoped))
	} catch (error) {
		console.error(error)
		process.exitCode = 1
	}
}

void main()

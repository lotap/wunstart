// Postgres reachability probe. Runs as a CHILD PROCESS of branch-env (not
// imported) so a dependency refresh is visible to the probe even when the
// long-lived parent process predates it.
// Prints one line: `READY <url-with-database>`, `NOADMIN`, `AUTHFAIL`
// (credentials rejected — distinct from down, so branch-env does not misdiagnose
// it as "port taken" and spin up a second postgres), `UNREACHABLE`, `BUSY`
// (reachable but overloaded/timed out), or `ERROR` (pg itself could not load).
//
// Constraint: node builtins + erasable syntax only, so it
// runs under `bun` and `node 22.18+`. Never add a dependency.

import {basename} from 'node:path'
import process from 'node:process'

import {PROBE_CONNECT_TIMEOUT_MS, PROBE_QUERY_TIMEOUT_MS, probeUrls, runProbe} from './postgres.ts'

async function main(): Promise<void> {
	// Secrets arrive via env (argv is visible in `ps`); argv kept as a
	// fallback for standalone runs.
	const base: string = process.env['PROBE_BASE'] ?? process.argv[2] ?? ''
	const want: string = process.env['PROBE_WANT'] ?? process.argv[3] ?? ''
	let pg: typeof import('pg')
	try {
		pg = await import('pg')
	} catch {
		console.log('ERROR')
		return
	}
	const urls = probeUrls(base, want)
	if (urls === null) {
		// UNREACHABLE, not ERROR: the parent maps it to the own-stack arm,
		// which fails with the accurate 'DATABASE_URL is invalid' hint.
		console.log('UNREACHABLE')
		return
	}
	const {adminUrl, readyUrl} = urls
	// Same bounds as the in-process probe: a stalled query must not hang branch-env.
	const pool = new pg.Pool({
		connectionString: adminUrl,
		connectionTimeoutMillis: PROBE_CONNECT_TIMEOUT_MS,
		query_timeout: PROBE_QUERY_TIMEOUT_MS,
	})
	// Single teardown in `finally` (guarded): an `await pool.end()` inside a
	// `catch` would mask the original error if teardown itself throws.
	try {
		const kind = await runProbe((text, params) => pool.query(text, params), want)
		if (kind === 'ready') {
			console.log(`READY ${readyUrl}`)
		} else {
			console.log(kind.toUpperCase())
		}
	} finally {
		try {
			await pool.end()
		} catch {
			// Teardown must never mask the probe result above.
		}
	}
}

// basename compare, not endsWith: any *-probe-postgres-child.ts entrant
// importing this module would otherwise look "directly invoked" and run
// main() on import.
const invokedDirectly: boolean = basename(process.argv[1] ?? '') === 'probe-postgres-child.ts'
if (invokedDirectly) {
	main().catch(() => {
		console.log('ERROR')
	})
}

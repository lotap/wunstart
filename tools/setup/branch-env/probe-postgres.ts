/* oxlint-disable anti-slop/no-runtime-typeof -- spawn errors are untyped by nature; code/status/signal narrowing at the boundary is the parse */
// Postgres reachability probe: in-process when `pg` is already importable,
// otherwise a fresh child process (the process may predate a dependency
// refresh and not see the just-installed `pg`). Secrets travel via
// env, never argv (argv is visible in `ps`).

import {execFileSync} from 'node:child_process'
import {dirname, join} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

import {ROOT} from '../../helpers/paths.ts'
import {PROBE_CONNECT_TIMEOUT_MS, PROBE_QUERY_TIMEOUT_MS, probeUrls, runProbe} from './postgres.ts'
import {spawnEnv} from './process.ts'

/** Child-process postgres probe (same directory). */
const PROBE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'probe-postgres-child.ts')

export type ProbeResult =
	| {status: 'ready'; url: string}
	| {status: 'noadmin'}
	| {status: 'authfail'}
	| {status: 'unreachable'}
	| {status: 'busy'}
	| {status: 'error'}

/** In-process probe; null when `pg` is not importable (caller falls back to the child). */
async function probeInProcess(base: string, want: string): Promise<ProbeResult | null> {
	let pg: typeof import('pg')

	try {
		pg = await import('pg')
	} catch {
		return null
	}

	const urls = probeUrls(base, want)

	if (urls === null) {
		// Deliberately unreachable, not error: the own-stack arm re-derives
		// the port with withPort (also null) and fails with the accurate
		// 'DATABASE_URL is invalid' hint, while error would misreport
		// 'did dependencies install?'. Unreachable in practice — the
		// pre-confirm validation checks the URL shape before any probe runs.
		return {status: 'unreachable'}
	}

	const {adminUrl, readyUrl} = urls

	// connectionTimeoutMillis bounds connect; query_timeout bounds a wedged
	// server that accepts the socket but stalls the query (else branch-env hangs
	// — the startStack readiness loop cannot help, it is a later phase).
	const pool = new pg.Pool({
		connectionString: adminUrl,
		connectionTimeoutMillis: PROBE_CONNECT_TIMEOUT_MS,
		query_timeout: PROBE_QUERY_TIMEOUT_MS,
	})

	// Guarded teardown in `finally`: an `await pool.end()` inside a `catch`
	// would mask the original error if teardown itself throws.
	try {
		const kind = await runProbe((text, params) => pool.query(text, params), want)

		if (kind === 'ready') {
			return {status: 'ready', url: readyUrl}
		}

		return {status: kind}
	} finally {
		try {
			await pool.end()
		} catch {
			// Teardown must never mask the probe result above.
		}
	}
}

export async function probePostgres(base: string, want: string): Promise<ProbeResult> {
	const local: ProbeResult | null = await probeInProcess(base, want)

	if (local !== null) {
		return local
	}

	let out: string

	try {
		// pg timeouts bound queries, not a wedged runtime/loader: the child
		// gets its own wall clock (timeout kill surfaces as a signal, which
		// the catch below already maps to 'error'). 25s covers the
		// worst-case probe (~12s of pg timeouts) plus runtime startup on
		// slow CI; the sync probes stay on the shorter shared clock.
		out = execFileSync(process.execPath, [PROBE_PATH], {
			cwd: ROOT,
			encoding: 'utf8',
			env: spawnEnv({PROBE_BASE: base, PROBE_WANT: want}),
			timeout: 25000,
		}).trim()
	} catch (error) {
		// Only a clean UNREACHABLE print means "postgres is down". Anything
		// that prevented the probe itself from running (missing runtime, a
		// non-zero exit, a kill signal) is an error: misreading it as
		// unreachable sends branch-env down the "start our own postgres" arm for
		// a problem a second postgres cannot fix.
		// SAFETY: Node reports spawn failure in error.code (errno strings:
		// ENOENT, EACCES, ETIMEDOUT), the exit code in error.status, and
		// kills in error.signal.
		const info = error as {code?: unknown; status?: unknown; signal?: unknown} | null
		const code: unknown = info?.code
		const status: unknown = info?.status
		const signal: unknown = info?.signal

		if (
			typeof code === 'string' ||
			(typeof status === 'number' && status !== 0) ||
			typeof signal === 'string'
		) {
			return {status: 'error'}
		}

		return {status: 'unreachable'}
	}

	// Verdict is the last non-empty line, not the whole blob: a stray
	// warning line from the child must not mask the verdict it printed.
	const lines: Array<string> = out
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line !== '')

	const verdict: string = lines.length > 0 ? (lines[lines.length - 1] ?? '') : ''

	if (verdict.startsWith('READY ')) {
		return {status: 'ready', url: verdict.slice('READY '.length)}
	}

	if (verdict === 'NOADMIN') {
		return {status: 'noadmin'}
	}

	if (verdict === 'AUTHFAIL') {
		return {status: 'authfail'}
	}

	if (verdict === 'BUSY') {
		return {status: 'busy'}
	}

	if (verdict === 'ERROR') {
		return {status: 'error'}
	}

	return {status: 'unreachable'}
}

// Postgres: existing-container reuse, shared probe, and container startup.

import {fail, ok, step} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {phaseCommand} from '../../helpers/package-manager.ts'
import {persistLocal} from './local-env.ts'
import {PORT_OWNER_TRIAGE} from './ports.ts'
import {sameDbUrl, withDb, withPort} from './postgres.ts'
import type {ProbeResult} from './probe-postgres.ts'
import {probePostgres} from './probe-postgres.ts'
import {
	COMPOSE_TIMEOUT_MS,
	findCidLine,
	findPort,
	run,
	runQuiet,
	tryCapture,
	waitForPostgres,
} from './process.ts'

export type OwnPostgres = {cid: string; state: string; port: string}

/**
 * Our compose project's postgres container, if one exists. --all keeps a
 * stopped container visible. Docker cannot report a port for a stopped
 * container, so the plan uses `state` and only carries a port while running
 * or paused.
 */
export function readOwnPostgres(): OwnPostgres | null {
	const cid: string = findCidLine(
		tryCapture('docker', ['compose', 'ps', '-q', '--all', 'postgres']),
	)

	if (cid === '') {
		return null
	}

	const state: string =
		tryCapture('docker', ['inspect', '-f', '{{.State.Status}}', cid]) ?? 'unknown'

	const port: string =
		state === 'running' || state === 'paused'
			? findPort(tryCapture('docker', ['compose', 'port', 'postgres', '5432']))
			: ''

	return {cid, state, port}
}

/** Wait before retrying a recovery probe: an immediate retry cannot outlast a restart. */
const PROBE_RETRY_DELAY_MS = 1500

/**
 * Retry an unreachable or busy probe once, after a real pause: a restart,
 * laptop wake, or short overload is not a dead server.
 */
async function probeWithRetry(base: string, want: string): Promise<ProbeResult> {
	const first: ProbeResult = await probePostgres(base, want)

	if (first.status !== 'unreachable' && first.status !== 'busy') {
		return first
	}

	await new Promise((resolve) => setTimeout(resolve, PROBE_RETRY_DELAY_MS))

	return probePostgres(base, want)
}

/** Per-status hints; failProbe appends the re-run tail uniformly. */
type ProbeHints = {
	authfail: string
	noadmin: string
	error: string
	unhealthy: string
	busy: string
}

/** Own-container hints (reuse + fresh stack): stale override or a sick container. */
const OWN_PROBE_HINTS: ProbeHints = {
	authfail: 'is DATABASE_URL stale? check .env.local (override) and .env.development (committed)',
	noadmin:
		'use a superuser DATABASE_URL (the default postgres user) — check .env.local for a restricted override',
	error: 'did dependencies install?',
	unhealthy: 'check the container logs, then re-run',
	busy: 'wait for it to recover (a restart or laptop wake can stall it), then re-run',
}

/** Shared-port hints: fix the config or wait, never touch the shared container. */
const SHARED_PROBE_HINTS: ProbeHints = {
	authfail:
		'wrong password? fix DATABASE_URL in .env.development (committed) or .env.local (override)',
	noadmin: 'run with a postgres you administer (this one refuses CREATE DATABASE)',
	error: 'did dependencies install?',
	unhealthy: 'stop the unhealthy service on this port, then re-run',
	busy: 'wait for the shared postgres to finish starting or recover, then re-run',
}

/**
 * One shape for every postgres-probe failure: the status decides the
 * message, the caller supplies the port-scoped subject and the arm's hints.
 */
function failProbe(
	status: 'authfail' | 'noadmin' | 'error' | 'unreachable' | 'busy',
	subject: string,
	hints: ProbeHints,
	rerun: string,
): never {
	// Unreachable here means the port answered nothing usable (own arms
	// probe a container that just reported ready) — an unhealthy subject,
	// not a cue to start another stack.
	const kind: 'authfail' | 'noadmin' | 'error' | 'unhealthy' | 'busy' =
		status === 'unreachable' ? 'unhealthy' : status

	const tail = ` — then re-run: ${rerun}`

	if (kind === 'authfail') {
		fail(`${subject} rejected these credentials`, `${hints.authfail}${tail}`)
	}

	if (kind === 'noadmin') {
		fail(
			`${subject} accepts these credentials but cannot create databases`,
			`${hints.noadmin}${tail}`,
		)
	}

	if (kind === 'error') {
		fail('postgres probe failed before connecting', `${hints.error}${tail}`)
	}

	if (kind === 'busy') {
		fail(`${subject} accepted the connection but did not answer in time`, `${hints.busy}${tail}`)
	}

	fail(`${subject} is unhealthy`, `${hints.unhealthy}${tail}`)
}

/** Wait for a revived/ready container, failing with logs rather than a data wipe. */
async function waitOrFail(cid: string, rerun: string): Promise<void> {
	const waited: 'ready' | 'terminal' | 'timeout' = await waitForPostgres(cid, 10, true)

	if (waited !== 'ready') {
		fail(
			'our postgres container did not become ready',
			`check the container logs (docker logs ${cid}), then re-run: ${rerun}`,
		)
	}
}

/**
 * Start/unpause our own container. Volume intact either way; the container
 * may be recreated on the scanned-free port because Compose cannot publish
 * the old mapping while the shared container owns :5432.
 */
async function reviveOwnPostgres(
	own: OwnPostgres,
	revivePort: string,
	rerun: string,
): Promise<string> {
	if (own.state === 'paused') {
		step('our postgres container is paused — unpausing…')

		if (runQuiet('docker', ['unpause', own.cid]) !== 0) {
			fail('could not unpause our postgres container', `check its state, then re-run: ${rerun}`)
		}

		await waitOrFail(own.cid, rerun)
		ok('our postgres container unpaused')

		return own.cid
	}

	// `up -d` does not unpause, so paused containers take the branch above.
	// Pass the scanned port explicitly: an exported POSTGRES_PORT or stray
	// .env must not recreate on a port branch-env never scanned, and the
	// default :5432 is usually held by the shared container.
	if (revivePort === '') {
		fail(
			'our postgres container is stopped and no free port was found to start it',
			`stop an unused stack to free a port (${PORT_OWNER_TRIAGE}), then re-run: ${rerun}`,
		)
	}

	step(`our postgres container is ${own.state} — starting it on :${revivePort} (data intact)…`)

	if (
		run(
			'docker',
			['compose', 'up', '-d', 'postgres'],
			{POSTGRES_PORT: revivePort},
			COMPOSE_TIMEOUT_MS,
		) !== 0
	) {
		fail(
			'docker compose up failed',
			`check the compose logs and that :${revivePort} is still free, then re-run: ${rerun}`,
		)
	}

	// Re-resolve like startStack: up -d keeps the ID for a stopped container,
	// but a daemon that recreates it would leave own.cid pointing at a dead ID.
	const revivedCid: string = findCidLine(
		tryCapture('docker', ['compose', 'ps', '-q', '--all', 'postgres']),
	)

	if (revivedCid === '') {
		fail('postgres container never became ready', `check the compose logs, then re-run: ${rerun}`)
	}

	await waitOrFail(revivedCid, rerun)
	ok('our postgres container started')

	return revivedCid
}

/** Named params. */
type ReuseInputs = {
	own: OwnPostgres | null
	preflightUrl: string
	dbWant: string
	revivePort: string
	pm: Pm
}

/**
 * Our own postgres container from a previous run: ensure the branch
 * database on its published port. Null when there is no own container (the
 * caller then tries the shared postgres). Own-first is deliberate: a
 * worktree that has its own data never silently switches to a shared one.
 */
export async function reuseOwnPostgres(
	inputs: ReuseInputs,
): Promise<{url: string; port: string} | null> {
	const {own, preflightUrl, dbWant, revivePort, pm} = inputs
	const rerun: string = phaseCommand(pm, 'branch-env')

	if (own === null) {
		return null
	}

	if (own.state === 'running') {
		if (runQuiet('docker', ['exec', own.cid, 'pg_isready', '-U', 'postgres']) !== 0) {
			step('our postgres container is running but not ready — waiting…')
			await waitOrFail(own.cid, rerun)
		}
	} else {
		await reviveOwnPostgres(own, revivePort, rerun)
	}

	// findPort: trailing-port match, not split(':') — IPv6 compose output
	// (`[::]:5433`) has no usable last colon segment.
	const ownPort: string = findPort(tryCapture('docker', ['compose', 'port', 'postgres', '5432']))

	if (!/^\d+$/.test(ownPort)) {
		fail(
			'our postgres container has no published port',
			`check the postgres service ports in compose.yaml, then recreate it without deleting data: docker compose up -d --force-recreate postgres — then re-run: ${rerun}`,
		)
	}

	const ownUrl: string | null = withPort(preflightUrl, ownPort)

	if (ownUrl === null) {
		fail(
			'DATABASE_URL is invalid',
			'check .env.local (override) and .env.development (committed) — restore the committed one: git checkout -- .env.development',
		)
	}

	const probe: ProbeResult = await probeWithRetry(ownUrl, dbWant)

	if (probe.status !== 'ready') {
		failProbe(probe.status, `our postgres on :${ownPort}`, OWN_PROBE_HINTS, rerun)
	}

	ok(`reusing our postgres on :${ownPort} — branch database '${dbWant}' ensured`)

	return {url: probe.url, port: ownPort}
}

/** Named params. */
type ProbeInputs = {
	preflightUrl: string
	dbWant: string
	probePort: string
	pgFree: number | null
	pm: Pm
}

/**
 * Shared postgres when our credentials work there; otherwise claim the
 * already-scanned free port for our own stack.
 */
export async function probeSharedPostgres(
	inputs: ProbeInputs,
): Promise<{effectiveUrl: string; postgresPort: string; startOwnPostgres: boolean}> {
	const {preflightUrl, dbWant, probePort, pgFree, pm} = inputs
	const rerun: string = phaseCommand(pm, 'branch-env')
	// Retry once before falling back to an own stack, or every transient
	// shared hiccup would permanently pin this worktree to its own container.
	const probe: ProbeResult = await probeWithRetry(preflightUrl, dbWant)

	if (probe.status === 'ready') {
		ok(`postgres on :${probePort} shared — branch database '${dbWant}' ensured (no new container)`)

		return {effectiveUrl: probe.url, postgresPort: '', startOwnPostgres: false}
	}

	if (probe.status !== 'unreachable') {
		failProbe(probe.status, `postgres on :${probePort}`, SHARED_PROBE_HINTS, rerun)
	}

	if (pgFree === null) {
		fail('no free postgres port found', `stop an unused stack (${PORT_OWNER_TRIAGE}), then re-run`)
	}

	const postgresPort: string = String(pgFree)
	const portSwapped: string | null = withPort(preflightUrl, postgresPort)

	if (portSwapped === null) {
		fail(
			'DATABASE_URL is invalid',
			'check .env.local (override) and .env.development (committed) — restore the committed one: git checkout -- .env.development',
		)
	}

	const ownUrl: string | null = withDb(portSwapped, dbWant)

	if (ownUrl === null) {
		fail(
			'DATABASE_URL is invalid',
			'check .env.local (override) and .env.development (committed) — restore the committed one: git checkout -- .env.development',
		)
	}

	// Unreachable here means down, filtered, or held by a non-postgres
	// service (ready/authfail/noadmin/error all returned above) — all
	// that is certain is no usable postgres answers on this port.
	ok(`no usable postgres on :${probePort} — our own postgres will run on :${postgresPort}`)

	return {effectiveUrl: ownUrl, postgresPort, startOwnPostgres: true}
}

/** Named params. */
type StackInputs = {
	startOwnPostgres: boolean
	postgresPort: string
	mailpitSmtpPort: string
	mailpitHttpPort: string
	effectiveUrl: string
	dbWant: string
	managedOverrides: Map<string, string>
	pm: Pm
}

/**
 * Containers, then the ensure probe (step 6). Every resolved port is passed
 * explicitly: an exported POSTGRES_PORT/MAILPIT_* or a stray .env would
 * otherwise override compose's defaults and bind a port branch-env never scanned
 * or reported. Returns the (possibly normalized) effective URL.
 */
export async function startStack(inputs: StackInputs): Promise<string> {
	const {
		startOwnPostgres,
		postgresPort,
		mailpitSmtpPort,
		mailpitHttpPort,
		effectiveUrl,
		dbWant,
		managedOverrides,
		pm,
	} = inputs

	const rerun: string = phaseCommand(pm, 'branch-env')

	const sharedPorts = {
		MAILPIT_SMTP_PORT: mailpitSmtpPort,
		MAILPIT_HTTP_PORT: mailpitHttpPort,
	}

	const composePorts = startOwnPostgres
		? {...sharedPorts, POSTGRES_PORT: postgresPort}
		: sharedPorts

	step('starting containers…')

	if (!startOwnPostgres) {
		if (run('docker', ['compose', 'up', '-d', 'mailpit'], composePorts, COMPOSE_TIMEOUT_MS) !== 0) {
			fail(
				'docker compose up failed',
				`check the compose logs and that :${mailpitSmtpPort}/:${mailpitHttpPort} are still free, then re-run: ${rerun}`,
			)
		}

		return effectiveUrl
	}

	if (run('docker', ['compose', 'up', '-d'], composePorts, COMPOSE_TIMEOUT_MS) !== 0) {
		fail(
			'docker compose up failed',
			`check the compose logs and that :${postgresPort}/:${mailpitSmtpPort}/:${mailpitHttpPort} are still free, then re-run: ${rerun}`,
		)
	}

	// The container id is stable after `up -d`: resolve it once, then poll
	// readiness with backoff. Capped at ~36s total when the daemon answers
	// (a healthy postgres answers pg_isready in seconds); a wedged daemon
	// burns the 15s exec wall clock per try instead — still bounded, slower.
	// --all: if `up -d` started a container that immediately exited, the
	// bare `-q` read misses it and reports "never became ready" instead
	// of the accurate "stopped while starting".
	const freshCid: string = findCidLine(
		tryCapture('docker', ['compose', 'ps', '-q', '--all', 'postgres']),
	)

	if (freshCid === '') {
		fail('postgres container never became ready', 'check docker compose logs, then re-run')
	}

	const waited: 'ready' | 'terminal' | 'timeout' = await waitForPostgres(freshCid, 15, true)

	if (waited === 'terminal') {
		fail('postgres container stopped while starting', 'check docker compose logs, then re-run')
	}

	if (waited !== 'ready') {
		fail('postgres container never became ready', 'check docker compose logs, then re-run')
	}

	// Fresh stack, fresh port: ensure the branch database exists and
	// normalize the URL (the preflight runs before the container does,
	// so it cannot CREATE here — without this, migrate would land in
	// the `postgres` system database).
	const ensure: ProbeResult = await probeWithRetry(effectiveUrl, dbWant)

	if (ensure.status !== 'ready') {
		failProbe(ensure.status, `our postgres on :${postgresPort}`, OWN_PROBE_HINTS, rerun)
	}

	// Re-persist only when the normalized URL differs, keeping fresh
	// stacks to a single write. URL-normalized compare: the probe rebuilds
	// via `new URL`, which can differ textually for the same database.
	if (!sameDbUrl(ensure.url, effectiveUrl)) {
		managedOverrides.set('DATABASE_URL', ensure.url)
		persistLocal(managedOverrides)

		return ensure.url
	}

	return effectiveUrl
}

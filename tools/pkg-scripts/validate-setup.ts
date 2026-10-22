/* oxlint-disable no-await-in-loop -- mailpit readiness poll is serial by design */
import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {dirname, join} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

import {isValidSlug} from '../helpers/app-name.ts'
import {parseCli, rejectPositionals} from '../helpers/cli.ts'
import {dependencyFreshness} from '../helpers/dependencies.ts'
import type {Pm} from '../helpers/package-manager.ts'
import {
	detectPm,
	installHint,
	phaseCommand,
	pmFromPackageManagerField,
	pmRun,
	presentLockfiles,
} from '../helpers/package-manager.ts'
import {killedBySigint, probeBoth} from '../helpers/probe.ts'
import {
	readAppInfoFile,
	readPackageJson,
	readWorkerName,
	routeTreePresent,
	wasmState,
} from '../helpers/project-files.ts'
import type {EffectiveEnv} from '../helpers/required-env.ts'
import {envReadFailure, loadEffectiveEnv, validateEnvVars} from '../helpers/required-env.ts'
import {runEntry} from '../helpers/run-phase.ts'
import {MAILPIT_HTTP_WANT} from '../helpers/trunk-ports.ts'

/**
 * `bun run validate-setup` — first thing agents run in a fresh worktree, and what
 * humans run when stuck. Verifies env, wasm, generated routes, dependencies,
 * docker, and postgres reachability, with a fix hint per failure.
 * Hints follow the detected package manager (lockfiles); with zero or
 * several lockfiles the wording stays manager-neutral instead of guessing.
 */

type CheckStatus = 'ok' | 'warn' | 'fail'

type CheckResult = {
	name: string
	status: CheckStatus
	detail: string
	hint: string
}

/**
 * Copy-pasteable branch-env re-run, or neutral wording when no manager won
 * (null: zero or several lockfiles matched — never guess).
 */
function rerunHint(pm: Pm | null): string {
	return pm === null
		? 'run the branch-env script with your package manager'
		: phaseCommand(pm, 'branch-env')
}

/** Copy-pasteable app-identity command for name failures. */
function identityHint(pm: Pm | null): string {
	return pm === null
		? 'run the app-identity script with your package manager'
		: phaseCommand(pm, 'app-identity')
}

/** Copy-pasteable install-deps command for dependency failures. */
function depsHint(pm: Pm | null): string {
	return pm === null
		? 'run the install-deps script with your package manager'
		: phaseCommand(pm, 'install-deps')
}

/** Copy-pasteable `run <script>`, or neutral wording when no manager won. */
function scriptHint(pm: Pm | null, script: string): string {
	return pm === null ? `run the ${script} script with your package manager` : pmRun(pm, script)
}

/**
 * Split a URL into a probe target (dual-stack localhost default, via
 * probeBoth at the call sites). Null when it does not parse — one shape
 * for the postgres and mailpit checks. Bracketed IPv6 literals (`[::1]`)
 * are unbracketed: new URL keeps the brackets in hostname, but net.connect
 * rejects the bracketed form (ENOTFOUND).
 */
function splitHostPort(raw: string, fallbackPort: number): {host: string; port: number} | null {
	try {
		const url = new URL(raw)
		let port = fallbackPort

		if (url.port !== '') {
			const parsed: number = Number(url.port)

			if (!Number.isNaN(parsed)) {
				port = parsed
			}
		}

		// Strip IPv6 brackets: new URL keeps them in hostname ("[::1]"),
		// but net.connect rejects the bracketed form (ENOTFOUND).
		const host: string = url.hostname.replace(/^\[(.*)\]$/, '$1')

		return {host: host === '' ? 'localhost' : host, port}
	} catch {
		return null
	}
}

function checkEnvFromValidation(
	issues: Array<{key: string; problem: string}>,
	overlaid: boolean,
	path: string,
): CheckResult {
	if (issues.length > 0) {
		const detail: string = issues.map((issue) => `${issue.key} ${issue.problem}`).join('; ')

		return {
			name: 'env',
			status: 'fail',
			detail,
			hint: 'fix .env.local (override) or .env.development (committed) — see the issues above',
		}
	}

	const suffix: string = overlaid ? ' (+ .env.local)' : ''

	return {name: 'env', status: 'ok', detail: `${path}${suffix}: ok`, hint: ''}
}

function checkWasm(pm: Pm | null): CheckResult {
	const wasm = wasmState()

	if (!wasm.present) {
		return {
			name: 'wasm',
			status: 'fail',
			detail: 'kernel is missing',
			hint: `restore it: git checkout -- src/durable-objects/argon2-do-hasher.wasm — or rebuild: ${scriptHint(pm, 'build:wasm')} (needs rust)`,
		}
	}

	if (wasm.bytes === 0) {
		return {
			name: 'wasm',
			status: 'fail',
			detail: 'kernel is empty',
			hint: 'restore it: git checkout -- src/durable-objects/argon2-do-hasher.wasm',
		}
	}

	return {
		name: 'wasm',
		status: 'ok',
		detail: `kernel present (${Math.round(wasm.bytes / 1024)} KB)`,
		hint: '',
	}
}

function checkRoutes(): CheckResult {
	if (!routeTreePresent()) {
		return {
			name: 'routes',
			status: 'fail',
			detail: 'routeTree.gen.ts is missing',
			hint: 'restore it: git checkout -- src/routeTree.gen.ts — then run dev once (the TanStack Start plugin regenerates it)',
		}
	}

	return {name: 'routes', status: 'ok', detail: 'routeTree.gen.ts present', hint: ''}
}

function checkDeps(pm: Pm | null): CheckResult {
	if (!existsSync('node_modules')) {
		return {
			name: 'deps',
			status: 'fail',
			detail: 'node_modules is missing',
			hint: `run: ${depsHint(pm)}`,
		}
	}

	if (pm === null) {
		const lockfiles = presentLockfiles()

		const detail: string =
			lockfiles.length === 0
				? 'no lockfile identifies the package manager'
				: `package manager is ambiguous (${lockfiles.map((lock) => lock.file).join(', ')})`

		return {
			name: 'deps',
			status: 'fail',
			detail: `cannot verify freshness: ${detail}`,
			hint: `run: ${depsHint(pm)}`,
		}
	}

	const freshness = dependencyFreshness(pm)

	if (!freshness.fresh) {
		return {
			name: 'deps',
			status: 'fail',
			detail: `dependencies are not fresh — ${freshness.reason}`,
			hint: `run: ${depsHint(pm)}`,
		}
	}

	return {name: 'deps', status: 'ok', detail: 'node_modules present and fresh', hint: ''}
}

function checkDocker(pm: Pm | null): CheckResult {
	// Bounded like branch-env's own daemon probe: a wedged daemon must fail
	// this gate in 45s, not hang it forever (branch-env invokes this gate as
	// its final step, so a hang here hangs the whole run).
	const result = spawnSync('docker', ['info'], {stdio: 'ignore', timeout: 45000})

	// Same SIGINT guard as branch-env's own probes: Ctrl-C kills the whole
	// process group, and without this the null status misreports an
	// unreachable daemon. Only SIGINT — a SIGTERM kill is the timeout
	// above, which keeps failing normally.
	if (killedBySigint(result.signal)) {
		process.exit(130)
	}

	// SAFETY: spawnSync reports a missing binary in error.code (ENOENT);
	// a daemon-down failure has status 1 instead. Conflating them sends
	// a no-docker machine to start a daemon it does not have.
	if (result.error instanceof Error && (result.error as {code?: unknown}).code === 'ENOENT') {
		return {
			name: 'docker',
			status: 'fail',
			detail: 'docker is not installed',
			hint: installHint('docker'),
		}
	}

	if (result.status !== 0) {
		return {
			name: 'docker',
			status: 'fail',
			detail: 'docker daemon is not reachable',
			hint: `start Docker Desktop (or dockerd) — then ${rerunHint(pm)}`,
		}
	}

	return {name: 'docker', status: 'ok', detail: 'daemon reachable', hint: ''}
}

async function checkPostgres(env: Map<string, string>, pm: Pm | null): Promise<CheckResult> {
	const raw: string | undefined = env.get('DATABASE_URL')

	if (raw === undefined || raw === '') {
		return {
			name: 'postgres',
			status: 'fail',
			detail: 'DATABASE_URL is missing or empty (checked .env.local over .env.development)',
			hint: 'set it in .env.local (override) or restore .env.development: git checkout -- .env.development',
		}
	}

	const target = splitHostPort(raw, 5432)

	if (target === null) {
		return {
			name: 'postgres',
			status: 'fail',
			detail: 'DATABASE_URL does not parse as a URL',
			hint: 'fix it in .env.local (override) or restore .env.development: git checkout -- .env.development',
		}
	}

	const {host, port} = target
	const up: boolean = await probeBoth(host, port, 2000)

	if (!up) {
		return {
			name: 'postgres',
			status: 'fail',
			detail: `${host}:${port} refused the connection (is postgres stopped?)`,
			hint: `start it: ${rerunHint(pm)} (recreates the stack on the claimed ports) — then re-run validate-setup`,
		}
	}

	return {name: 'postgres', status: 'ok', detail: `${host}:${port} reachable`, hint: ''}
}

async function checkMailpit(env: Map<string, string>, pm: Pm | null): Promise<CheckResult> {
	const raw: string = env.get('MAILPIT_URL') ?? `http://localhost:${MAILPIT_HTTP_WANT}`
	const target = splitHostPort(raw, MAILPIT_HTTP_WANT)

	if (target === null) {
		return {
			name: 'mailpit',
			status: 'fail',
			detail: `MAILPIT_URL does not parse as a URL: ${raw}`,
			hint: `fix it in .env.local (override) — branch-env pins it only when shifted from :${MAILPIT_HTTP_WANT}`,
		}
	}

	const {host, port} = target
	// Retried: branch-env starts mailpit with `up -d` and immediately runs
	// this gate, and a cold/slow container can be healthy yet not
	// listening on the first probe.
	let up = false

	for (let attempt = 0; attempt < 5; attempt += 1) {
		up = await probeBoth(host, port, 1000)

		if (up) {
			break
		}

		if (attempt < 4) {
			await new Promise((resolve) => setTimeout(resolve, 250))
		}
	}

	if (!up) {
		return {
			name: 'mailpit',
			status: 'fail',
			detail: `${host}:${port} refused the connection (is mailpit stopped?)`,
			hint: `start it: ${rerunHint(pm)} (brings the stack up on the claimed ports) — then re-run validate-setup`,
		}
	}

	return {name: 'mailpit', status: 'ok', detail: `${host}:${port} reachable`, hint: ''}
}

function checkNames(pm: Pm | null): CheckResult {
	const pkg = readPackageJson()

	if (!pkg.ok) {
		const problem: string = pkg.reason === 'invalid' ? 'not valid JSON' : 'missing or unreadable'

		return {
			name: 'names',
			status: 'fail',
			detail: `package.json is ${problem}`,
			hint: 'restore it: git checkout -- package.json',
		}
	}

	const workerName: string | null = readWorkerName()

	if (workerName === null) {
		return {
			name: 'names',
			status: 'fail',
			detail: 'wrangler.jsonc is missing, unreadable, or has no worker name',
			hint: 'restore it: git checkout -- wrangler.jsonc',
		}
	}

	const appInfo = readAppInfoFile()

	if (appInfo?.name === undefined || appInfo.description === undefined) {
		return {
			name: 'names',
			status: 'fail',
			detail: 'src/app-info.ts is missing its name or description field',
			hint: 'restore it: git checkout -- src/app-info.ts',
		}
	}

	const pkgName: string = pkg.file.name
	const appInfoName: string = appInfo.name

	// Agreement is not validity: validate all before comparing, or a
	// corrupted-but-matching set passes and fails at deploy instead.
	for (const [where, value] of [
		['package.json', pkgName],
		['wrangler.jsonc', workerName],
		['src/app-info.ts', appInfoName],
	] as const) {
		const problem: string | null = isValidSlug(value)

		if (problem !== null) {
			return {
				name: 'names',
				status: 'fail',
				detail: `app name '${value}' in ${where} is not a valid slug (${problem})`,
				hint: `rename: ${identityHint(pm)}`,
			}
		}
	}

	if (pkgName !== workerName || pkgName !== appInfoName) {
		return {
			name: 'names',
			status: 'fail',
			detail: `names differ (package.json: ${pkgName}, wrangler.jsonc: ${workerName}, src/app-info.ts: ${appInfoName})`,
			hint: `align them: ${identityHint(pm)}`,
		}
	}

	if (pkgName === 'wunstart') {
		return {
			name: 'names',
			status: 'warn',
			detail: 'still on kit defaults',
			hint: `rename: ${identityHint(pm)}`,
		}
	}

	return {name: 'names', status: 'ok', detail: `app name is ${pkgName}`, hint: ''}
}

/**
 * Dev-port check: vite.config.ts throws without DEV_PORT (same
 * present + integer + 1–65535 rule), so a worktree whose .env.local
 * predates the feature fails dev with no other signal. Setup writes
 * this value, so a failure points back at branch-env.
 */
function checkDevPort(env: Map<string, string>, pm: Pm | null): CheckResult {
	const raw: string | undefined = env.get('DEV_PORT')

	if (raw === undefined || raw === '') {
		return {
			name: 'dev-port',
			status: 'fail',
			detail: 'DEV_PORT is missing (the dev server refuses to start without it)',
			hint: `claim it: ${rerunHint(pm)} (writes .env.local) — then re-run validate-setup`,
		}
	}

	const port: number = Number(raw)

	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		return {
			name: 'dev-port',
			status: 'fail',
			detail: `DEV_PORT=${JSON.stringify(raw)} is not a valid port`,
			hint: `fix it in .env.local (override) — or ${rerunHint(pm)}`,
		}
	}

	return {name: 'dev-port', status: 'ok', detail: `dev port is :${port}`, hint: ''}
}

/**
 * First-run check: is this a fresh database that still needs setup?
 * Only runs when postgres is reachable. `to_regclass` returns null for a
 * missing table instead of raising, so no error-code parsing is needed.
 */
async function checkFirstRun(
	postgres: CheckResult,
	connectionString: string,
	pm: Pm | null,
): Promise<CheckResult> {
	if (postgres.status !== 'ok') {
		return {
			name: 'first-run',
			status: 'warn',
			detail: 'skipped (postgres unreachable)',
			hint: '',
		}
	}

	// Dynamic import: a static one would throw ERR_MODULE_NOT_FOUND before
	// main runs when node_modules is absent — exactly when checkDeps exists
	// to report it friendly. Unreachable here only when postgres answered
	// but deps were never installed.
	const pg = await import('pg').catch(() => null)

	if (pg === null) {
		return {
			name: 'first-run',
			status: 'fail',
			detail: 'pg package is missing (dependencies not installed)',
			hint: `install them, then ${rerunHint(pm)}`,
		}
	}

	const pool = new pg.Pool({
		connectionString,
		connectionTimeoutMillis: 2000,
		query_timeout: 5000,
	})

	try {
		const table = await pool.query<{present: string | null}>(
			"SELECT to_regclass('public.users') AS present",
		)

		const tableRow = table.rows[0]

		if (tableRow === undefined) {
			return {
				name: 'first-run',
				status: 'fail',
				detail: 'database inspection returned no rows',
				hint: `is postgres healthy? ${rerunHint(pm)}`,
			}
		}

		if (tableRow.present === null) {
			return {
				name: 'first-run',
				status: 'fail',
				detail: 'no tables yet (migrations not applied)',
				hint: `run: ${scriptHint(pm, 'db:migrate')} — or ${rerunHint(pm)}`,
			}
		}

		const counted = await pool.query<{total: string}>('SELECT count(*) AS total FROM public.users')
		const countRow = counted.rows[0]
		const total: number = countRow === undefined ? Number.NaN : Number(countRow.total)

		if (Number.isNaN(total)) {
			return {
				name: 'first-run',
				status: 'fail',
				detail: 'could not count users',
				hint: `is postgres healthy? ${rerunHint(pm)}`,
			}
		}

		if (total === 0) {
			return {
				name: 'first-run',
				status: 'warn',
				detail: 'fresh database — no users yet',
				hint: 'sign up in the app to create the first user',
			}
		}

		return {name: 'first-run', status: 'ok', detail: `${total} user(s) present`, hint: ''}
	} catch (error) {
		// SAFETY: pg errors carry a string `code` (SQLSTATE); anything else
		// falls through to the generic branch below.
		// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type
		const code: unknown = error instanceof Error ? (error as {code?: unknown}).code : null

		if (code === '3D000') {
			return {
				name: 'first-run',
				status: 'fail',
				detail: 'database does not exist (was it dropped?)',
				hint: `re-create it: ${rerunHint(pm)}`,
			}
		}

		if (code === '28P01' || code === '28000') {
			return {
				name: 'first-run',
				status: 'fail',
				detail: 'password authentication failed (DATABASE_URL password wrong?)',
				hint: 'fix the password in .env.local (override) or .env.development (committed)',
			}
		}

		return {
			name: 'first-run',
			status: 'fail',
			detail: 'could not inspect the database',
			hint: `is postgres healthy? ${rerunHint(pm)}`,
		}
	} finally {
		// Guarded teardown (same as the branch-env probe): a failing end()
		// must not mask — or reject out of — the verdict above.
		try {
			await pool.end()
		} catch {
			// Teardown must not mask the probe result above.
		}
	}
}

function usage(): void {
	console.log(`usage: validate-setup [--help]

  Verifies env, wasm kernel, generated routes, dependencies, docker,
  dev-port claim, identity, and postgres/mailpit reachability, with a fix
  hint per failure. Run from anywhere inside the worktree (paths anchor at
  the repo root). Exit code 1 when any check fails.`)
}

async function main(): Promise<void> {
	const parsed = parseCli(process.argv.slice(2), {}, usage)
	rejectPositionals(parsed.positionals, 'this program takes flags only (see --help)')
	// Anchor at the repo root (two levels above tools/helpers): every path
	// below is root-relative, and running from a subdirectory would
	// otherwise misreport (branch-env's paths are script-absolute already).
	process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..', '..'))
	// Manager for hint wording, detected once from lockfiles. With no
	// lockfile at all, package.json's packageManager is the same fallback
	// install-deps and branch-env use.
	let pm: Pm | null = detectPm()

	if (pm === null && presentLockfiles().length === 0) {
		const pkg = readPackageJson()
		pm = pkg.ok ? pmFromPackageManagerField(pkg.file.packageManager) : null
	}

	// Single env load: read once, validate the vars, reuse them below.
	const path = '.env.development'

	const fallback: EffectiveEnv = {
		vars: new Map<string, string>(),
		overlaid: false,
		devVars: new Map<string, string>(),
	}

	let effective: EffectiveEnv
	let envFailure: {culprit: string; hint: string} | null = null

	try {
		effective = loadEffectiveEnv(path, '.env.local')
	} catch {
		envFailure = envReadFailure(path, '.env.local')
		effective = fallback
	}

	const envIssues = envFailure === null ? validateEnvVars(effective.vars) : []

	const envCheck: CheckResult =
		envFailure === null
			? checkEnvFromValidation(envIssues, effective.overlaid, path)
			: {
					name: 'env',
					status: 'fail',
					detail: `${envFailure.culprit} is missing or unreadable`,
					hint: envFailure.hint,
				}

	const {vars: env} = effective

	const results: Array<CheckResult> = [
		envCheck,
		checkWasm(pm),
		checkRoutes(),
		checkDeps(pm),
		checkDocker(pm),
		checkNames(pm),
		checkDevPort(env, pm),
	]

	// One root cause, one fail: when the URL postgres would probe is itself
	// missing or invalid, the postgres check would fail too. Other env
	// failures (a bad *_SECRETS value) keep the reachability signal.
	// checkFirstRun already warn-skips on a non-ok postgres check.
	const dbUrlBroken: boolean =
		envFailure !== null || envIssues.some((issue) => issue.key === 'DATABASE_URL')

	const postgresCheck: CheckResult = dbUrlBroken
		? {
				name: 'postgres',
				status: 'warn',
				detail: 'skipped — DATABASE_URL is missing or invalid (see env check)',
				hint: '',
			}
		: await checkPostgres(env, pm)

	results.push(postgresCheck)
	results.push(await checkMailpit(env, pm))
	const rawUrl: string | undefined = env.get('DATABASE_URL')
	const connectionString: string = rawUrl === undefined ? '' : rawUrl
	results.push(await checkFirstRun(postgresCheck, connectionString, pm))

	let fails = 0
	let warns = 0

	for (const result of results) {
		if (result.status === 'fail') {
			fails += 1
		}

		if (result.status === 'warn') {
			warns += 1
		}

		console.log(`${result.status}  ${result.name} — ${result.detail}`)

		if (result.hint !== '') {
			console.log(`     hint: ${result.hint}`)
		}
	}

	console.log(`validate-setup: ${results.length - fails - warns} ok, ${warns} warn, ${fails} fail`)

	if (fails > 0) {
		process.exitCode = 1
	}
}

// Never print a raw stack: an unexpected error (env read, probe
// import) must report like every other failure — scrubbed, with the
// same re-run hint shape as the checks above.
runEntry(
	import.meta.url,
	main,
	() => `${rerunHint(detectPm())} (unexpected validate-setup failure — report the FAIL line above)`,
)

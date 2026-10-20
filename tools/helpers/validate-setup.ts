import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync, statSync} from 'node:fs'
import {basename, dirname, join} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

import type {EffectiveEnv, TopLevelName} from './validate-required-env.ts'
import {
	AUTH_DYNAMIC_ROUTE_MARKER,
	findTopLevelName,
	loadEffectiveEnv,
	probeTcp,
	validateEnvVars,
} from './validate-required-env.ts'

/**
 * `bun run validate-setup` — first thing agents run in a fresh worktree, and what
 * humans run when stuck. Verifies env, wasm kernel, generated routes,
 * dependencies, docker, and postgres reachability, with a fix hint per failure.
 */

type CheckStatus = 'ok' | 'warn' | 'fail'

type CheckResult = {
	name: string
	status: CheckStatus
	detail: string
	hint: string
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

function checkWasm(): CheckResult {
	const path = 'src/durable-objects/argon2-do-hasher.wasm'
	if (!existsSync(path)) {
		return {
			name: 'wasm',
			status: 'fail',
			detail: 'kernel is missing',
			hint: 'restore it: git checkout -- src/durable-objects/argon2-do-hasher.wasm — or rebuild: bun --bun run build:wasm (needs rust)',
		}
	}
	const bytes: number = statSync(path).size
	if (bytes === 0) {
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
		detail: `kernel present (${Math.round(bytes / 1024)} KB)`,
		hint: '',
	}
}

function checkRoutes(): CheckResult {
	const path = 'src/routeTree.gen.ts'
	if (!existsSync(path)) {
		return {
			name: 'routes',
			status: 'fail',
			detail: 'routeTree.gen.ts is missing',
			hint: 'regenerate: bun --bun run generate-routes (or restart `bun run dev`)',
		}
	}
	const text: string = readFileSync(path, 'utf8')
	if (!text.includes(AUTH_DYNAMIC_ROUTE_MARKER)) {
		return {
			name: 'routes',
			status: 'fail',
			detail: `routeTree.gen.ts looks stale (no ${AUTH_DYNAMIC_ROUTE_MARKER} route)`,
			hint: 'regenerate: bun --bun run generate-routes (or restart `bun run dev`)',
		}
	}
	return {name: 'routes', status: 'ok', detail: 'routeTree.gen.ts present', hint: ''}
}

function checkDeps(): CheckResult {
	if (!existsSync('node_modules')) {
		return {
			name: 'deps',
			status: 'fail',
			detail: 'node_modules is missing',
			hint: 'install: bun install (or just `bun run dev` — predev self-provisions)',
		}
	}
	return {name: 'deps', status: 'ok', detail: 'node_modules present', hint: ''}
}

function checkDocker(): CheckResult {
	// Bounded like setup's own daemon probe: a wedged daemon must fail
	// this gate in 45s, not hang it forever (setup invokes this gate as
	// its final step, so a hang here hangs the whole run).
	const result = spawnSync('docker', ['info'], {stdio: 'ignore', timeout: 45000})
	if (result.status !== 0) {
		return {
			name: 'docker',
			status: 'fail',
			detail: 'docker daemon is not reachable',
			hint: 'start Docker Desktop (or dockerd) — then re-run `bun run setup`',
		}
	}
	return {name: 'docker', status: 'ok', detail: 'daemon reachable', hint: ''}
}

async function checkPostgres(env: Map<string, string>): Promise<CheckResult> {
	const raw: string | undefined = env.get('DATABASE_URL')
	if (raw === undefined || raw === '') {
		return {
			name: 'postgres',
			status: 'fail',
			detail: 'DATABASE_URL is missing or empty (checked .env.local over .env.development)',
			hint: 'set it in .env.local (override) or restore .env.development: git checkout -- .env.development',
		}
	}
	let host = 'localhost'
	let port = 5432
	try {
		const url = new URL(raw)
		if (url.hostname !== '') {
			host = url.hostname
		}
		if (url.port !== '') {
			const parsed: number = Number(url.port)
			if (!Number.isNaN(parsed)) {
				port = parsed
			}
		}
	} catch {
		return {
			name: 'postgres',
			status: 'fail',
			detail: 'DATABASE_URL does not parse as a URL',
			hint: 'fix it in .env.local (override) or restore .env.development: git checkout -- .env.development',
		}
	}
	// Dual-stack like setup's isPortOpen: 'localhost' can resolve to either
	// family, and a ::1-only bind reads as down on a v4-only probe.
	const up: boolean =
		host === 'localhost'
			? (await probeTcp('127.0.0.1', port, 2000)) || (await probeTcp('::1', port, 2000))
			: await probeTcp(host, port, 2000)
	if (!up) {
		return {
			name: 'postgres',
			status: 'fail',
			detail: `${host}:${port} refused the connection (is postgres stopped?)`,
			hint: 'start it: re-run `bun run setup` (recreates the stack on the claimed ports) — then re-run `bun run validate-setup`',
		}
	}
	return {name: 'postgres', status: 'ok', detail: `${host}:${port} reachable`, hint: ''}
}

/**
 * Name at a finder location: same depth-tracked finder setup.ts renames
 * with ({@link findTopLevelName}), so single-line/minified wrangler files
 * pass here exactly when setup accepts them. Extracts from the qualified
 * offset, not the first match on the line (a minified line can hold a
 * nested `"name"` first).
 */
function nameOnLine(lines: Array<string>, found: TopLevelName | null): string | null {
	if (found === null) {
		return null
	}
	const line: string | undefined = lines[found.line]
	if (line === undefined) {
		return null
	}
	const match: RegExpExecArray | null = /"name"\s*:\s*"([^"]*)"/.exec(line.slice(found.at))
	if (match === null) {
		return null
	}
	const raw: string | undefined = match[1]
	return raw ?? null
}

function checkNames(): CheckResult {
	let pkgText: string
	let workerText: string
	try {
		pkgText = readFileSync('package.json', 'utf8')
	} catch {
		return {
			name: 'names',
			status: 'fail',
			detail: 'package.json is missing or unreadable',
			hint: 'restore it: git checkout -- package.json',
		}
	}
	try {
		workerText = readFileSync('wrangler.jsonc', 'utf8')
	} catch {
		return {
			name: 'names',
			status: 'fail',
			detail: 'wrangler.jsonc is missing or unreadable',
			hint: 'restore it: git checkout -- wrangler.jsonc',
		}
	}
	const pkgLines: Array<string> = pkgText.split('\n')
	const workerLines: Array<string> = workerText.split('\n')
	const pkgName: string | null = nameOnLine(pkgLines, findTopLevelName(pkgLines))
	const workerName: string | null = nameOnLine(workerLines, findTopLevelName(workerLines))
	if (pkgName === null || workerName === null) {
		return {
			name: 'names',
			status: 'fail',
			detail: 'could not read the app name from package.json / wrangler.jsonc',
			hint: 'rename: bun run setup my-app',
		}
	}
	if (pkgName === 'wunstart' || workerName === 'wunstart') {
		return {
			name: 'names',
			status: 'warn',
			detail: `still on kit defaults (package.json: ${pkgName}, worker: ${workerName})`,
			hint: 'rename: bun run setup my-app (npm: npm run setup -- my-app --pm npm)',
		}
	}
	if (pkgName !== workerName) {
		return {
			name: 'names',
			status: 'warn',
			detail: `package.json (${pkgName}) and worker name (${workerName}) differ`,
			hint: 'align them: bun run setup my-app',
		}
	}
	return {name: 'names', status: 'ok', detail: `app name is ${pkgName}`, hint: ''}
}

/**
 * First-run check: is this a fresh database that still needs setup?
 * Only runs when postgres is reachable. `to_regclass` returns null for a
 * missing table instead of raising, so no error-code parsing is needed.
 */
async function checkFirstRun(
	postgres: CheckResult,
	connectionString: string,
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
			hint: 'install them, then re-run: bun run setup my-app',
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
				hint: 'is postgres healthy? re-run `bun run setup`',
			}
		}
		if (tableRow.present === null) {
			return {
				name: 'first-run',
				status: 'fail',
				detail: 'no tables yet (migrations not applied)',
				hint: 'run: bun --bun run db:migrate — or re-run: bun run setup my-app',
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
				hint: 'is postgres healthy? re-run `bun run setup`',
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
				hint: 're-create it: bun run setup my-app',
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
			hint: 'is postgres healthy? re-run `bun run setup`',
		}
	} finally {
		// Guarded teardown (same as the setup probe): a failing end()
		// must not mask — or reject out of — the verdict above.
		try {
			await pool.end()
		} catch {
			// Teardown must not mask the probe result above.
		}
	}
}

async function main(): Promise<void> {
	// Anchor at the repo root (two levels above tools/helpers): every path
	// below is root-relative, and running from a subdirectory would
	// otherwise misreport (setup's paths are script-absolute already).
	process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..', '..'))
	// Single env load: read once, validate the vars, reuse them below.
	// The try covers the stat and the read together (no existsSync + read).
	const path = '.env.development'
	const fallback: EffectiveEnv = {
		vars: new Map<string, string>(),
		overlaid: false,
		devVars: new Map<string, string>(),
	}
	let effective: EffectiveEnv
	let devPresent = false
	try {
		effective = loadEffectiveEnv(path, '.env.local')
		devPresent = true
	} catch {
		effective = fallback
	}
	const envIssues = devPresent
		? validateEnvVars(effective.vars)
		: [{key: path, problem: 'file is missing (it is committed — restore it)'}]
	const envCheck: CheckResult = checkEnvFromValidation(
		envIssues,
		devPresent && effective.overlaid,
		path,
	)
	const {vars: env} = effective
	const results: Array<CheckResult> = [
		envCheck,
		checkWasm(),
		checkRoutes(),
		checkDeps(),
		checkDocker(),
		checkNames(),
	]
	// One root cause, one fail: when the URL postgres would probe is itself
	// missing or invalid, the postgres check would fail too. Other env
	// failures (a bad *_SECRETS value) keep the reachability signal.
	// checkFirstRun already warn-skips on a non-ok postgres check.
	const dbUrlBroken: boolean =
		!devPresent || envIssues.some((issue) => issue.key === 'DATABASE_URL')
	const postgresCheck: CheckResult = dbUrlBroken
		? {
				name: 'postgres',
				status: 'warn',
				detail: 'skipped — DATABASE_URL is missing or invalid (see env check)',
				hint: '',
			}
		: await checkPostgres(env)
	results.push(postgresCheck)
	const rawUrl: string | undefined = env.get('DATABASE_URL')
	const connectionString: string = rawUrl === undefined ? '' : rawUrl
	results.push(await checkFirstRun(postgresCheck, connectionString))

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

// basename compare, not endsWith: any *-validate-setup.ts entrant importing
// this module would otherwise look "directly invoked" and run main() on import.
const invokedDirectly: boolean = basename(process.argv[1] ?? '') === 'validate-setup.ts'
if (invokedDirectly) {
	void main()
}

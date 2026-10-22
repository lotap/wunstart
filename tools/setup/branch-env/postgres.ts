// Postgres-specific helpers: URL manipulation (probe URLs, pool URLs,
// identity comparison) and probe execution/classification (auth vs down
// vs won race). probe-postgres.ts (in-process probe) and
// probe-postgres-child.ts (child fallback) share the query path so the
// two executors agree; branch-env's plan/stack use the URL half for pool and
// desired-state URLs. No runtime imports —
// notably never `pg` (unavailable pre-install) — so both executors (bun,
// node 22.18+ type stripping) can load this file.
//
// Constraint: node builtins + erasable syntax only.
// Never add a dependency.

/**
 * Clone a URL with a different port and/or pathname (query/auth kept).
 * Single constructor behind withPort/withDb/probeUrls so the three cannot
 * drift apart; null when the base does not parse (callers fail with a hint).
 */
function mutateUrl(base: string, change: {port?: string; pathname?: string}): string | null {
	try {
		const url = new URL(base)

		if (change.port !== undefined) {
			url.port = change.port
		}

		if (change.pathname !== undefined) {
			url.pathname = change.pathname
		}

		return url.toString()
	} catch {
		return null
	}
}

/** Admin + branch URLs derived from a base URL (query/auth preserved). */
export function probeUrls(base: string, want: string): {adminUrl: string; readyUrl: string} | null {
	const adminUrl: string | null = mutateUrl(base, {pathname: '/postgres'})
	const readyUrl: string | null = mutateUrl(base, {pathname: `/${want}`})

	if (adminUrl === null || readyUrl === null) {
		return null
	}

	return {adminUrl, readyUrl}
}

/**
 * What `pg` surfaces as an error `code`: SQLSTATE strings ('28P01'), errno
 * strings ('ECONNREFUSED'), or nothing at all. Named (not `unknown`) so
 * callers narrow at the boundary instead of passing `unknown` through.
 */
type PgErrorCode = string | number | null | undefined

/** Wrong-password SQLSTATEs: distinct from down (see AUTHFAIL handling). */
function isAuthFailure(code: PgErrorCode): boolean {
	return code === '28P01' || code === '28000'
}

/**
 * duplicate_database: a concurrent branch-env run won the CREATE race — the database
 * exists, so the loser reports success instead of NOADMIN.
 */
function isRaceWon(code: PgErrorCode): boolean {
	return code === '42P04'
}

/**
 * Local query timeout (pg's `Query read timeout`, no `code`) and
 * too_many_connections: the server is reachable but overloaded, not down.
 * Both are retryable; starting another stack cannot fix them.
 */
function isBusy(error: Error | null): boolean {
	if (error?.message === 'Query read timeout') {
		return true
	}

	// SAFETY: pg attaches sqlstate/errno in `code`; a non-pg Error has none.
	const code: PgErrorCode = error === null ? undefined : (error as {code?: PgErrorCode}).code

	return code === '53300'
}

/** Dropped-connection errnos: the server went away mid-probe. */
const CONNECTION_LOSS_CODES: ReadonlySet<string> = new Set([
	'ECONNREFUSED',
	'ECONNRESET',
	'ECONNABORTED',
	'ENOTFOUND',
	'ETIMEDOUT',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'EPIPE',
	'EAI_AGAIN',
])

/**
 * The socket dropped after a successful connect (restart, refused, reset):
 * unreachable, not noadmin. A missing code counts too — a dead socket
 * rarely carries one, and "cannot create databases" would mislead.
 */
function isConnectionLoss(code: PgErrorCode): boolean {
	if (code === null || code === undefined) {
		return true
	}

	// SAFETY: numbers (exit codes) never equal a string set member, so
	// membership-testing without narrowing cannot misclassify.
	return CONNECTION_LOSS_CODES.has(code as string)
}

/** Quote a Postgres identifier (defense in depth — callers pre-sanitize). */
function quoteIdent(value: string): string {
	return `"${value.replace(/"/g, '""')}"`
}

/** Bound a connect attempt (a down server refuses fast; filtered hosts burn this). */
export const PROBE_CONNECT_TIMEOUT_MS = 2000

/** Bound a stalled query on an accepted socket (a wedged server must not hang branch-env). */
export const PROBE_QUERY_TIMEOUT_MS = 5000

/** Minimal query surface runProbe needs (pg's pool.query satisfies this). */
type ProbeQueryFn = (text: string, params?: Array<string>) => Promise<{rows: Array<unknown>}>

export type ProbeKind = 'ready' | 'noadmin' | 'authfail' | 'unreachable' | 'busy'

/**
 * SELECT 1 → ensure-database → classify, shared by the in-process probe
 * and the child fallback. One copy: auth/race fixes land once. Callers
 * supply the query function and map the outcome (in-process returns a URL,
 * the child prints a token).
 */
export async function runProbe(query: ProbeQueryFn, want: string): Promise<ProbeKind> {
	try {
		await query('SELECT 1')
	} catch (error) {
		// A reachable-but-overloaded server is not down: retrying (or waiting)
		// is the fix, not starting a second stack.
		if (isBusy(error instanceof Error ? error : null)) {
			return 'busy'
		}

		// SAFETY: pg surfaces SQLSTATE in `code` (28P01 = bad password) and
		// syscall failures as errno-style codes; anything else is unreachable.
		const code: PgErrorCode = (error as {code?: PgErrorCode} | null)?.code

		return isAuthFailure(code) ? 'authfail' : 'unreachable'
	}

	try {
		const found = await query('SELECT 1 FROM pg_database WHERE datname = $1', [want])

		if (found.rows.length === 0) {
			await query(`CREATE DATABASE ${quoteIdent(want)}`)
		}

		return 'ready'
	} catch (error) {
		if (isBusy(error instanceof Error ? error : null)) {
			return 'busy'
		}

		// SAFETY: pg surfaces SQLSTATE in `code`; a won CREATE race means
		// the database exists, so report success.
		const code: PgErrorCode = (error as {code?: PgErrorCode} | null)?.code

		if (isRaceWon(code)) {
			return 'ready'
		}

		// A drop after a successful connect is the server going away, not a
		// permissions problem: unreachable keeps the caller on the revive /
		// start-own path instead of reporting "cannot create databases".
		if (isConnectionLoss(code)) {
			return 'unreachable'
		}

		// admin_shutdown means the server is going away — retry (or fall to
		// an own stack) instead of reporting "cannot create databases".
		if (code === '57P01') {
			return 'unreachable'
		}

		return 'noadmin'
	}
}

/** Clone a postgres URL with a different port (query/path/auth kept); null when the base does not parse. */
export function withPort(base: string, port: string): string | null {
	return mutateUrl(base, {port})
}

/** Clone a postgres URL with a different database pathname (port/query/auth kept); null when the base does not parse. */
export function withDb(base: string, db: string): string | null {
	return mutateUrl(base, {pathname: `/${db}`})
}

/** Port embedded in a URL, or the fallback when it is missing/unparseable. */
export function portOf(url: string, fallback = '5432'): string {
	try {
		return new URL(url).port || fallback
	} catch {
		return fallback
	}
}

/**
 * Same database? Compares URL-normalized forms: the probe builds URLs via
 * `new URL(...).toString()`, which can differ textually from the committed
 * spelling (trailing slash, default-port elision) for the same database.
 * Unparseable inputs fall back to raw comparison.
 */
export function sameDbUrl(a: string, b: string): boolean {
	try {
		return normalizeDbUrl(a) === normalizeDbUrl(b)
	} catch {
		return a === b
	}
}

/**
 * Fill the elided default postgres port so `postgres://h/db` matches
 * `postgres://h:5432/db` (postgres is not a special scheme, so `new URL`
 * keeps an explicit :5432 instead of eliding it). postgres/postgresql
 * only: other schemes have different defaults.
 */
function normalizeDbUrl(raw: string): string {
	const url = new URL(raw)

	if ((url.protocol === 'postgres:' || url.protocol === 'postgresql:') && url.port === '') {
		url.port = '5432'
	}

	// A trailing slash carries no database identity (`/db` vs `/db/`), but
	// `new URL(...).toString()` preserves it — strip it so a hand-edited
	// committed URL still matches the probe-normalized form.
	if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
		url.pathname = url.pathname.slice(0, -1)
	}

	return url.toString()
}

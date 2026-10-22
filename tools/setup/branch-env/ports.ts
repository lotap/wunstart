/* oxlint-disable no-await-in-loop -- port scans are serial socket batches by design */
// Per-branch port claims: hash-stable when free, shifted to the next free port
// when another process already holds the claim. Best effort, not a reservation.

import {fail, ok, warn} from '../../helpers/output.ts'
import {probeBoth} from '../../helpers/probe.ts'
import {MAILPIT_HTTP_WANT, MAILPIT_SMTP_WANT} from '../../helpers/trunk-ports.ts'
import {tryCapture} from './process.ts'

/** Localhost connect timeout for port scans (refusals land in ms; at most 250ms burned on a filtered host). */
const PORT_PROBE_TIMEOUT_MS = 250

/** Port-scan window per claim (claims are branch-stable by hash). */
const PORT_SCAN_WIDTH = 50

/** Sockets opened per scan batch: lowest-free-wins within a batch. */
const PORT_SCAN_BATCH = 8

/**
 * Numeric branch fingerprint. Pure FNV-1a: identical on every machine with
 * zero spawns.
 */
function branchHash(branch: string): number {
	let hash: number = 0x811c9dc5
	for (let i = 0; i < branch.length; i += 1) {
		hash ^= branch.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193)
	}
	return hash >>> 0
}

/**
 * True when something is listening on port. Both loopbacks in one round:
 * a server bound to ::1 only reads as free on a 127.0.0.1-only check,
 * and the next bind then collides.
 */
async function isPortOpen(port: number): Promise<boolean> {
	return probeBoth('localhost', port, PORT_PROBE_TIMEOUT_MS)
}

/**
 * First TCP port >= start with nothing listening (50-wide window).
 * Lowest free port wins: usually one lookup round, up to ~7 sequential
 * batches when the range is full (8-wide batches, dual-stack per port).
 */
async function freePort(start: number): Promise<number | null> {
	// Fast path: the claim is usually free — one lookup round, not fifty.
	if (!(await isPortOpen(start))) {
		return start
	}
	// Otherwise scan in small batches (not 49 sockets at once, not 49
	// serial probes): same result, far fewer FDs — at most ~7 sequential
	// batches when the range is full.
	for (let base = start + 1; base < start + PORT_SCAN_WIDTH; base += PORT_SCAN_BATCH) {
		const ports: Array<number> = []
		for (
			let port = base;
			port < Math.min(base + PORT_SCAN_BATCH, start + PORT_SCAN_WIDTH);
			port += 1
		) {
			ports.push(port)
		}
		const open: Array<boolean> = await Promise.all(ports.map((port) => isPortOpen(port)))
		const free: number | undefined = ports.find((_, i) => open[i] === false)
		if (free !== undefined) {
			return free
		}
	}
	return null
}

/**
 * Mailpit claims are the compose defaults for every branch (unlike
 * dev/pg, which hash per branch): the plan promises mailpit shifts
 * only when the defaults are taken, and freePort does the shifting —
 * the pass/persist/plan comparisons anchor on MAILPIT_*_WANT (see
 * tools/helpers/trunk-ports.ts), so an unshifted run binds :1025/:8025
 * exactly like trunk.
 */
type IdentityClaims = {dbWant: string; devPortWant: number; pgPortWant: number}

/**
 * Branch-derived identity: one database and a hash-derived port preference
 * per branch. Ports are not reserved: a taken claim shifts to the next free
 * port, and hashed ranges can overlap other branches. Assumes one clone plus
 * worktrees: a second clone of the same branch claims the same ports and
 * database. Trunk keeps defaults — the committed URL points at the `postgres`
 * system database, so trunk migrates there. Conscious, not accidental:
 * changing it would orphan every existing trunk database.
 */
const CANONICAL_BRANCHES: ReadonlySet<string> = new Set(['trunk', 'main', 'master'])

export function claimIdentity(branch: string): IdentityClaims {
	if (CANONICAL_BRANCHES.has(branch)) {
		return {dbWant: 'postgres', devPortWant: 3000, pgPortWant: 5432}
	}
	// Sanitizing maps `feat-foo` and `feat/foo` to the same stem; the hash
	// is over the full branch string, so the 6-hex fragment still keeps
	// one database per branch (56 chars worst case — inside the 63-char
	// Postgres limit).
	const hash: number = branchHash(branch)
	const dbSane: string = branch
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '_')
		.slice(0, 40)
	const frag: string = (hash % 0x1000000).toString(16).padStart(6, '0')
	return {
		dbWant: `wunstart_${dbSane}_${frag}`,
		devPortWant: 3100 + (hash % 100),
		pgPortWant: 5433 + (hash % 50),
	}
}

type ScannedPorts = {devPort: number; smtpFree: number; httpFree: number; pgFree: number | null}

/**
 * Owner-triage fragment for "no free port" failures (shared by the mailpit
 * and postgres arms here and in stack.ts): the holder is almost always
 * another worktree's stack, and the branch -> database rule names it. Kept
 * as a fragment (not a full hint) so callers keep their own re-run tails.
 */
export const PORT_OWNER_TRIAGE =
	'git worktree list maps worktrees to branches (each claims its own ports; branch databases are wunstart_<branch>_<6hex> — drop that database first if its branch is done)'

/** One `git worktree list --porcelain` block. */
type WorktreeEntry = {path: string; ref: string | null}

/** Parse porcelain blocks (blank-line separated), ignoring bare/detached extras. */
function parseWorktrees(listOut: string): Array<WorktreeEntry> {
	const entries: Array<WorktreeEntry> = []
	let path: string | null = null
	let ref: string | null = null
	// Trailing blank synthesizes the final block boundary: porcelain's last
	// block may or may not end with one, and the flush must run either way.
	for (const line of [...listOut.split('\n'), '']) {
		if (line === '') {
			if (path !== null) {
				entries.push({path, ref})
			}
			path = null
			ref = null
			continue
		}
		if (line.startsWith('worktree ')) {
			path = line.slice('worktree '.length)
		} else if (line.startsWith('branch ')) {
			ref = line.slice('branch '.length).trim()
		}
	}
	return entries
}

export type WorktreeInspection = {
	canonical: Array<string>
	sibling: string | null
}

/**
 * One porcelain read for both warns: canonical branches sharing a database,
 * and another checkout of this branch (same DB/ports; migrations collide).
 * Worktrees, not refs: a repo that merely has both `trunk` and `main` refs
 * must not warn. Detached/bare worktrees carry no `branch` line and are
 * skipped; absence of evidence is not evidence, so a git failure is empty,
 * never a failure.
 */
export function inspectWorktrees(branch: string, root: string): WorktreeInspection {
	const out: string | null = tryCapture('git', ['worktree', 'list', '--porcelain'])
	if (out === null) {
		return {canonical: [], sibling: null}
	}
	const normRoot: string = root.replace(/\/+$/, '')
	const wantRef: string = `refs/heads/${branch}`
	const canonical = new Set<string>()
	let sibling: string | null = null
	for (const entry of parseWorktrees(out)) {
		if (entry.ref === null) {
			continue
		}
		const name: string = entry.ref.startsWith('refs/heads/')
			? entry.ref.slice('refs/heads/'.length)
			: entry.ref
		if (CANONICAL_BRANCHES.has(name)) {
			canonical.add(name)
		}
		if (sibling === null && entry.ref === wantRef && entry.path.replace(/\/+$/, '') !== normRoot) {
			sibling = entry.path
		}
	}
	return {canonical: [...canonical], sibling}
}

/** Named params. Pins mean that port or failure: no shifting, unlike claims. */
type ScanInputs = {
	devPortWant: number
	pgPortWant: number
	ownSmtpPort: string
	ownHttpPort: string
	devPin?: number
	pgPin?: number
	httpPin?: number
}

/**
 * A pinned port: probe it once and bind it, or fail loud. Unlike claims,
 * pins never shift to a neighbor — an explicit request must be predictable.
 */
async function requireFreePort(pin: number, flag: string): Promise<number> {
	if (!(await isPortOpen(pin))) {
		return pin
	}
	fail(
		`${flag} :${pin} is taken`,
		`free :${pin} (${PORT_OWNER_TRIAGE}), or pin another port, then re-run`,
	)
}

/**
 * First free port at or after each claim (usually the claim itself).
 * Independent claims probe concurrently. The postgres claim scans
 * speculatively too: same cost when the shared container answers,
 * saves a round trip when this run must start its own stack.
 */
export async function scanClaimedPorts(inputs: ScanInputs): Promise<ScannedPorts> {
	const {devPortWant, pgPortWant, ownSmtpPort, ownHttpPort, devPin, pgPin, httpPin} = inputs
	// If two branch-env runs ever race, the loser fails loudly on bind and converges on re-run.
	// A pin overrides our own mailpit's mapping for that side: the explicit
	// request wins, and compose recreates the mapping downstream.
	const smtpProbe: Promise<number | null> =
		ownSmtpPort !== '' ? Promise.resolve(Number(ownSmtpPort)) : freePort(MAILPIT_SMTP_WANT)
	let httpProbe: Promise<number | null>
	if (httpPin !== undefined) {
		httpProbe = requireFreePort(httpPin, '--mailpit-port')
	} else if (ownHttpPort !== '') {
		httpProbe = Promise.resolve(Number(ownHttpPort))
	} else {
		httpProbe = freePort(MAILPIT_HTTP_WANT)
	}
	const devProbe: Promise<number | null> =
		devPin !== undefined ? requireFreePort(devPin, '--dev-port') : freePort(devPortWant)
	const pgProbe: Promise<number | null> =
		pgPin !== undefined ? requireFreePort(pgPin, '--postgres-port') : freePort(pgPortWant)
	const [devPort, smtpFree, httpFree, pgFree] = await Promise.all([
		devProbe,
		smtpProbe,
		httpProbe,
		pgProbe,
	])
	if (devPort === null) {
		fail(
			'no free dev port found',
			`stop the process holding :${devPortWant} (lsof -ti :${devPortWant} -sTCP:LISTEN shows the owner — likely another worktree: git worktree list) or free one in the scan window, then re-run`,
		)
	}
	if (devPin === undefined && devPort !== devPortWant) {
		warn(`claimed dev port :${devPortWant} was taken — using :${devPort} instead`)
	}
	if (smtpFree === null) {
		fail('no free SMTP port found', `stop an unused stack (${PORT_OWNER_TRIAGE}), then re-run`)
	}
	if (httpFree === null) {
		fail(
			'no free mailpit HTTP port found',
			`stop an unused stack (${PORT_OWNER_TRIAGE}), then re-run`,
		)
	}
	// After the null fails: a half-reused scan must not print a :null side.
	const httpReused: boolean = httpPin === undefined && ownHttpPort !== ''
	if (ownSmtpPort !== '' || httpReused) {
		const sides: Array<string> = []
		if (ownSmtpPort !== '') {
			sides.push(`:${smtpFree} (smtp)`)
		}
		if (httpReused) {
			sides.push(`:${httpFree} (http)`)
		}
		ok(`reusing our mailpit on ${sides.join(' ')} — no port shift`)
	}
	return {devPort, smtpFree, httpFree, pgFree}
}

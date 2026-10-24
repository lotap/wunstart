/* oxlint-disable no-await-in-loop -- port scans are serial socket batches by design */
// Per-branch port claims: hash-stable when free, shifted to the next free port
// when another process already holds the claim. Best effort, not a reservation.

import {readFileSync, realpathSync} from 'node:fs'

import {
	AGENT_DEV_PORT_MAX,
	AGENT_DEV_PORT_MIN,
	AGENT_DEV_PORT_WIDTH,
	HUMAN_DEV_PORT_WANT,
	inAgentDevRange,
	parsePort,
} from '../../helpers/dev-ports.ts'
import {fail, ok, warn} from '../../helpers/output.ts'
import {ROOT} from '../../helpers/paths.ts'
import {probeBoth} from '../../helpers/probe.ts'
import {MAILPIT_HTTP_WANT, MAILPIT_SMTP_WANT} from '../../helpers/trunk-ports.ts'
import {sameDbUrl} from './postgres.ts'
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
 * First agent port at or after start without a listener or a live agent Vite
 * process, wrapping inside the agent range. Agent ports are shared per branch,
 * so the window is the whole 100-wide range: a full tail wraps to the front
 * instead of scanning past :3199.
 */
async function freeAgentPort(start: number, blocked: ReadonlySet<number>): Promise<number | null> {
	const normalized: number =
		(((start - AGENT_DEV_PORT_MIN) % AGENT_DEV_PORT_WIDTH) + AGENT_DEV_PORT_WIDTH) %
		AGENT_DEV_PORT_WIDTH

	const portAt = (offset: number): number =>
		AGENT_DEV_PORT_MIN + ((normalized + offset) % AGENT_DEV_PORT_WIDTH)

	if (!blocked.has(portAt(0)) && !(await isPortOpen(portAt(0)))) {
		return portAt(0)
	}

	for (let offset = 1; offset < AGENT_DEV_PORT_WIDTH; offset += PORT_SCAN_BATCH) {
		const ports: Array<number> = []
		const last: number = Math.min(offset + PORT_SCAN_BATCH, AGENT_DEV_PORT_WIDTH)

		for (let i = offset; i < last; i += 1) {
			ports.push(portAt(i))
		}

		const open: Array<boolean> = await Promise.all(
			ports.map(async (port) => blocked.has(port) || (await isPortOpen(port))),
		)

		const free: number | undefined = ports.find((_, i) => open[i] === false)

		if (free !== undefined) {
			return free
		}
	}

	return null
}

/** Normalize a checkout path for comparison (symlinks, trailing slashes). */
function normalizePath(path: string): string {
	try {
		return realpathSync(path)
	} catch {
		return path.replace(/\/+$/, '')
	}
}

/** True when a process cwd is this checkout (or a directory below it). */
function belongsToRoot(cwd: string | null): boolean {
	if (cwd === null || cwd === '') {
		return false
	}

	const processRoot: string = normalizePath(cwd)
	const repoRoot: string = normalizePath(ROOT)

	return processRoot === repoRoot || processRoot.startsWith(`${repoRoot}/`)
}

/** Listener PIDs for one port, deduplicated (lsof reports v4 and v6 separately). */
function listenerPids(port: number): Array<number> {
	const out: string | null = tryCapture('lsof', ['-nP', '-ti', `:${port}`, '-sTCP:LISTEN'])

	if (out === null || out === '') {
		return []
	}

	const pids = new Set<number>()

	for (const line of out.split('\n')) {
		const pid: number = Number(line.trim())

		if (Number.isInteger(pid) && pid > 0) {
			pids.add(pid)
		}
	}

	return [...pids]
}

/** Process cwd, from /proc on Linux and lsof on macOS/BSD. */
function processCwd(pid: number): string | null {
	try {
		return realpathSync(`/proc/${pid}/cwd`)
	} catch {
		// macOS/BSD: /proc is absent.
	}

	const out: string | null = tryCapture('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])

	if (out === null) {
		return null
	}

	for (const line of out.split('\n')) {
		if (line.startsWith('n')) {
			return line.slice(1)
		}
	}

	return null
}

/** Process command line (wide, so long module paths survive). */
function processCommand(pid: number): string {
	return tryCapture('ps', ['-ww', '-p', String(pid), '-o', 'command=']) ?? ''
}

/** Mirror of agent-dev.sh's Vite executable check. */
function isViteCommand(command: string): boolean {
	return /(^|\/)vite\.js($|\s)|\/\.bin\/vite($|\s)|\/vite\/bin\/vite($|\s)/.test(command)
}

function isViteProcess(pid: number): boolean {
	return isViteCommand(processCommand(pid))
}

/**
 * Process environment as a map: exact on Linux (/proc), best-effort from
 * `ps eww` on macOS. Null when the environment cannot be read, so callers
 * fail closed instead of trusting an unknown process.
 */
function processEnv(pid: number): Map<string, string> | null {
	const env = new Map<string, string>()

	try {
		const raw: string = readFileSync(`/proc/${pid}/environ`, 'utf8')

		for (const entry of raw.split('\0')) {
			const at: number = entry.indexOf('=')

			if (at > 0) {
				env.set(entry.slice(0, at), entry.slice(at + 1))
			}
		}

		return env
	} catch {
		// macOS/BSD: `ps eww` appends KEY=value pairs after the command.
	}

	const out: string | null = tryCapture('ps', ['eww', '-p', String(pid), '-o', 'command='])

	if (out === null) {
		return null
	}

	for (const token of out.split(' ')) {
		const at: number = token.indexOf('=')

		if (at > 0) {
			env.set(token.slice(0, at), token.slice(at + 1))
		}
	}

	return env
}

/**
 * Agent Vite ports that still have a process, including a wedged one that
 * lost its listener. freeAgentPort treats these as taken so branch-env does
 * not write a port that agent-dev will refuse to start on.
 */
function agentVitePortsInUse(): Set<number> {
	const ports = new Set<number>()
	const out: string | null = tryCapture('ps', ['-axww', '-o', 'pid=,command='])

	if (out === null) {
		return ports
	}

	for (const line of out.split('\n')) {
		const match = /^\s*(\d+)\s+(.*)$/.exec(line)

		if (match === null) {
			continue
		}

		const pidRaw: string | undefined = match[1]
		const command: string | undefined = match[2]

		if (pidRaw === undefined || command === undefined) {
			continue
		}

		const pid: number = Number(pidRaw)

		if (!Number.isInteger(pid) || pid <= 0 || !isViteCommand(command)) {
			continue
		}

		if (!belongsToRoot(processCwd(pid))) {
			continue
		}

		const env: Map<string, string> | null = processEnv(pid)

		if (env === null || env.get('DEV_ROLE') !== 'agent') {
			continue
		}

		const port: number | null = parsePort(env.get('AGENT_DEV_PORT'))

		if (port !== null && inAgentDevRange(port)) {
			ports.add(port)
		}
	}

	return ports
}

/** Database name from a postgres URL, or null when it is not a db URL. */
function databaseName(url: string): string | null {
	try {
		const parsed = new URL(url)

		if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
			return null
		}

		const name: string = decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/g, ''))

		return name === '' ? null : name
	} catch {
		return null
	}
}

/**
 * A stored agent port is reusable only when every listener is this
 * worktree's shared agent Vite for the branch's database *and* connection
 * URL. A host/port/credential change with the same database name must not
 * adopt a server still talking to the old endpoint.
 */
function isReusableAgentServer(port: number, dbWant: string, dbUrlWant: string): boolean {
	const pids: Array<number> = listenerPids(port)

	if (pids.length === 0) {
		return false
	}

	return pids.every((pid) => {
		if (!belongsToRoot(processCwd(pid)) || !isViteProcess(pid)) {
			return false
		}

		const env: Map<string, string> | null = processEnv(pid)

		if (env === null) {
			return false
		}

		if (env.get('DEV_ROLE') !== 'agent' || env.get('AGENT_DEV_PORT') !== String(port)) {
			return false
		}

		const liveUrl: string | undefined = env.get('DATABASE_URL')

		return (
			liveUrl !== undefined && databaseName(liveUrl) === dbWant && sameDbUrl(liveUrl, dbUrlWant)
		)
	})
}

type AgentScanInputs = {
	agentDevPortWant: number
	dbUrlWant: string
	dbWant: string
	ownAgentDevPort: number | null
}

export async function scanAgentPort(inputs: AgentScanInputs): Promise<AgentProbe> {
	const {agentDevPortWant, dbUrlWant, dbWant, ownAgentDevPort} = inputs
	const blocked: ReadonlySet<number> = agentVitePortsInUse()

	if (
		ownAgentDevPort !== null &&
		inAgentDevRange(ownAgentDevPort) &&
		(await isPortOpen(ownAgentDevPort)) &&
		isReusableAgentServer(ownAgentDevPort, dbWant, dbUrlWant)
	) {
		return {kept: true, port: ownAgentDevPort, storedBlocked: false}
	}

	return {
		kept: false,
		port: await freeAgentPort(agentDevPortWant, blocked),
		storedBlocked: ownAgentDevPort !== null && blocked.has(ownAgentDevPort),
	}
}

/**
 * Mailpit claims are the compose defaults for every branch (unlike
 * agent/pg, which hash per branch): the plan promises mailpit shifts
 * only when the defaults are taken, and freePort does the shifting —
 * the pass/persist/plan comparisons anchor on MAILPIT_*_WANT (see
 * tools/helpers/trunk-ports.ts), so an unshifted run binds :1025/:8025
 * exactly like trunk.
 */
type IdentityClaims = {agentDevPortWant: number; dbWant: string; pgPortWant: number}

/**
 * Branch-derived identity: one database, a hash-derived agent-server port,
 * and a postgres port preference per branch. The human dev port is not part
 * of branch identity — every worktree shares the default (:3000) unless a
 * human pins one. Agent ports are not reserved: a taken claim shifts to the
 * next free port in the agent range, and hashed ranges can overlap other
 * branches. Assumes one clone plus worktrees: a second clone of the same
 * branch claims the same ports and database. Trunk keeps database/postgres
 * defaults — the committed URL points at the `postgres` system database, so
 * trunk migrates there. Conscious, not accidental: changing it would orphan
 * every existing trunk database.
 */
const CANONICAL_BRANCHES: ReadonlySet<string> = new Set(['trunk', 'main', 'master'])

export function claimIdentity(branch: string): IdentityClaims {
	// Sanitizing maps `feat-foo` and `feat/foo` to the same stem; the hash
	// is over the full branch string, so the 6-hex fragment still keeps
	// one database per branch (56 chars worst case — inside the 63-char
	// Postgres limit).
	const hash: number = branchHash(branch)
	const agentDevPortWant: number = AGENT_DEV_PORT_MIN + (hash % AGENT_DEV_PORT_WIDTH)

	if (CANONICAL_BRANCHES.has(branch)) {
		return {agentDevPortWant, dbWant: 'postgres', pgPortWant: 5432}
	}

	const dbSane: string = branch
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '_')
		.slice(0, 40)

	const frag: string = (hash % 0x1000000).toString(16).padStart(6, '0')

	return {
		dbWant: `wunstart_${dbSane}_${frag}`,
		agentDevPortWant,
		pgPortWant: 5433 + (hash % 50),
	}
}

type ScannedPorts = {
	agentDevPort: number
	agentKept: boolean
	devPort: number
	smtpFree: number
	httpFree: number
	pgFree: number | null
}

type AgentProbe = {kept: boolean; port: number | null; storedBlocked: boolean}

/**
 * Owner-triage fragment for "no free port" failures (shared by the mailpit
 * and postgres arms here and in stack.ts): the holder is almost always
 * another worktree's stack, and `git worktree list` names it. Stopping that
 * stack frees the port; dropping its database is separate teardown. Kept as
 * a fragment (not a full hint) so callers keep their own re-run tails.
 */
export const PORT_OWNER_TRIAGE =
	"git worktree list maps worktrees to branches (each claims its own ports; stop the owning worktree's stack with docker compose down to free them, then drop its wunstart_<branch>_<6hex> database if the branch is done)"

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
	agentDevPortWant: number
	dbUrlWant: string
	dbWant: string
	pgPortWant: number
	ownAgentDevPort: number | null
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
	const {
		agentDevPortWant,
		dbUrlWant,
		dbWant,
		pgPortWant,
		ownAgentDevPort,
		ownSmtpPort,
		ownHttpPort,
		devPin,
		pgPin,
		httpPin,
	} = inputs

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

	// The human port is a human decision: no scanning, no shifting. A pin
	// must be free right now; the default is written and used whenever the
	// human starts their server. Both stay outside the agent range (CLI and
	// validate-setup enforce the boundary).
	const devProbe: Promise<number> =
		devPin !== undefined
			? requireFreePort(devPin, '--dev-port')
			: Promise.resolve(HUMAN_DEV_PORT_WANT)

	const agentProbe: Promise<AgentProbe> = scanAgentPort({
		agentDevPortWant,
		dbUrlWant,
		dbWant,
		ownAgentDevPort,
	})

	const pgProbe: Promise<number | null> =
		pgPin !== undefined ? requireFreePort(pgPin, '--postgres-port') : freePort(pgPortWant)

	const [devPort, agentProbeResult, smtpFree, httpFree, pgFree] = await Promise.all([
		devProbe,
		agentProbe,
		smtpProbe,
		httpProbe,
		pgProbe,
	])

	const agentDevPort: number | null = agentProbeResult.port

	if (agentDevPort === null) {
		fail(
			'no free agent dev port found',
			`free a port in :${AGENT_DEV_PORT_MIN}-:${AGENT_DEV_PORT_MAX} (sh tools/pkg-scripts/agent-dev.sh status shows owners; stop-all is human cleanup) or stop another worktree's agent servers, then re-run`,
		)
	}

	if (agentProbeResult.storedBlocked && ownAgentDevPort !== null) {
		warn(
			`stored agent dev port :${ownAgentDevPort} is held by an agent Vite process — using :${agentDevPort} instead; ask a human to run: sh tools/pkg-scripts/agent-dev.sh stop-all`,
		)
	} else if (agentDevPort !== agentDevPortWant) {
		if (agentProbeResult.kept) {
			ok(`stored agent dev port :${agentDevPort} is this branch's live server — keeping it`)
		} else if (ownAgentDevPort !== null && ownAgentDevPort !== agentDevPort) {
			warn(
				`stored agent dev port :${ownAgentDevPort} is not this branch's live server — using :${agentDevPort} instead`,
			)
		} else {
			warn(`agent dev port :${agentDevPortWant} was taken — using :${agentDevPort} instead`)
		}
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

	return {agentDevPort, agentKept: agentProbeResult.kept, devPort, smtpFree, httpFree, pgFree}
}

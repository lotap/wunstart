// Child processes and tool-presence probing shared by the setup programs.
// Phase-specific env overlays live with their phase; this leaf module only
// owns spawning and wall clocks.

import {execFileSync, spawnSync} from 'node:child_process'
import process from 'node:process'

import {ROOT} from './paths.ts'
import type {ChildSignal} from './probe.ts'
import {killedBySigint} from './probe.ts'

/**
 * Minimum node version (type stripping). 22.18 is the first node that
 * strips erasable syntax without a flag. Keep the `NAME = 'x.y'` shape:
 * tools/pkg-scripts/run-ts.sh greps this line because a shell cannot import TS.
 */
export const MINIMUM_NODE_VERSION = '22.18'

export type CommandEnv = Record<string, string | undefined>

/** Full child environment, optionally extended per call. */
export function spawnEnv(extra?: Record<string, string>) {
	return {...process.env, ...extra}
}

export type CaptureOptions = {
	env?: CommandEnv
	timeoutMs?: number
}

/**
 * Run and capture stdout (trimmed); null when the child fails or is missing.
 * Sync probes share one wall clock so a wedged daemon degrades to "not
 * found" instead of hanging a phase. Stderr is discarded: these are
 * optional probes, and their failure text is not the caller's diagnosis.
 */
const SYNC_PROBE_TIMEOUT_MS = 15000

export function tryCapture(
	cmd: string,
	args: Array<string>,
	options: CaptureOptions = {},
): string | null {
	try {
		return execFileSync(cmd, args, {
			cwd: ROOT,
			encoding: 'utf8',
			env: options.env ?? spawnEnv(),
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: options.timeoutMs ?? SYNC_PROBE_TIMEOUT_MS,
		}).trim()
	} catch (error) {
		// Ctrl-C kills the whole process group: the child dies by SIGINT
		// and the sync call throws instead of returning. Exit 130 like
		// run() — but only for SIGINT (a SIGTERM kill is our own timeout,
		// which must keep degrading to null).
		// SAFETY: execFileSync errors carry a `signal` string when killed by one; absent otherwise.
		if (error instanceof Error && killedBySigint((error as {signal?: ChildSignal}).signal)) {
			process.exit(130)
		}
		return null
	}
}

export type RunOptions = {
	env?: CommandEnv
	timeoutMs?: number
	/** Capture child output and replay it only on failure (quiet mode). */
	capture?: boolean
}

const CAPTURE_BUFFER_BYTES = 10 * 1024 * 1024

/**
 * Run inheriting stdio; returns the exit status (0 = success). Slow
 * children pass a wall clock: a wedged install or compose must fail
 * loudly, never hang the run. `capture` keeps stdout/stderr for failure
 * replay instead of streaming them.
 */
export function run(cmd: string, args: Array<string>, options: RunOptions = {}): number {
	const capture: boolean = options.capture === true
	const result = spawnSync(cmd, args, {
		cwd: ROOT,
		stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
		env: options.env ?? spawnEnv(),
		timeout: options.timeoutMs,
		encoding: capture ? 'utf8' : undefined,
		maxBuffer: capture ? CAPTURE_BUFFER_BYTES : undefined,
	})
	if (killedBySigint(result.signal)) {
		process.exit(130)
	}
	const status: number = result.status ?? 1
	if (capture && status !== 0) {
		const stdout: string = result.stdout ? result.stdout.toString() : ''
		const stderr: string = result.stderr ? result.stderr.toString() : ''
		if (stdout !== '') {
			process.stdout.write(stdout)
		}
		if (stderr !== '') {
			process.stderr.write(stderr)
		}
	}
	// SAFETY: spawnSync reports a timeout kill in error.code (ETIMEDOUT);
	// status is null there, which would otherwise read as a plain failure.
	if (result.error instanceof Error && (result.error as {code?: unknown}).code === 'ETIMEDOUT') {
		console.error(
			`${cmd} timed out after ${options.timeoutMs ?? 0}ms — re-run (slow machines and networks can need a retry)`,
		)
	}
	return status
}

/** Run silently; returns the exit status (0 = success). */
export function runQuiet(
	cmd: string,
	args: Array<string>,
	timeoutMs: number = SYNC_PROBE_TIMEOUT_MS,
	env?: CommandEnv,
): number {
	try {
		const result = spawnSync(cmd, args, {
			cwd: ROOT,
			stdio: 'ignore',
			env: env ?? spawnEnv(),
			timeout: timeoutMs,
		})
		if (killedBySigint(result.signal)) {
			process.exit(130)
		}
		return result.status ?? 1
	} catch {
		return 1
	}
}

/** Single --version spawn per binary per run. */
const toolPresenceCache = new Map<string, boolean>()

export function hasCommand(cmd: string): boolean {
	const hit: boolean | undefined = toolPresenceCache.get(cmd)
	if (hit !== undefined) {
		return hit
	}
	const present: boolean = tryCapture(cmd, ['--version']) !== null
	toolPresenceCache.set(cmd, present)
	return present
}

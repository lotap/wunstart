/* oxlint-disable no-await-in-loop -- readiness polls are serial by design */
// Branch-env child processes: spawns made through this module carry the
// mid-run .env.local overlay so compose, migrations, and probes see the
// branch's values. Docker presence checks run before the overlay exists.

import {existsSync} from 'node:fs'
import {join} from 'node:path'
import process from 'node:process'

import {isQuietMode} from '../../helpers/output.ts'
import {ROOT} from '../../helpers/paths.ts'
import type {CaptureOptions} from '../../helpers/process.ts'
import {
	run as helperRun,
	runQuiet as helperRunQuiet,
	tryCapture as helperTryCapture,
} from '../../helpers/process.ts'
import type {EffectiveEnv} from '../../helpers/required-env.ts'
import {loadEffectiveEnv} from '../../helpers/required-env.ts'
import {MAILPIT_HTTP_WANT, MAILPIT_SMTP_WANT} from '../../helpers/trunk-ports.ts'

export const COMPOSE_TIMEOUT_MS = 5 * 60 * 1000
export const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000
export const GATE_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Process-critical vars files must never shadow: a hand-added PATH breaks
 * every child spawn, loader vars would inject into them, and NODE_OPTIONS /
 * NODE_PATH would hijack node. App keys pass through untouched.
 */
const RESERVED_ENV_KEYS: ReadonlySet<string> = new Set([
	'PATH',
	'HOME',
	'TMPDIR',
	'TEMP',
	'TMP',
	'LD_PRELOAD',
	'LD_LIBRARY_PATH',
	'DYLD_LIBRARY_PATH',
	'DYLD_INSERT_LIBRARIES',
	'NODE_OPTIONS',
	'NODE_PATH',
])

let childEnvExtra: Record<string, string> = {}

/**
 * Recompute the child-process env overlay; returns the full effective env
 * so callers can reuse it instead of re-reading both files.
 */
export function refreshChildEnv(): EffectiveEnv {
	const devPath: string = join(ROOT, '.env.development')
	if (!existsSync(devPath)) {
		childEnvExtra = {}
		return {vars: new Map<string, string>(), overlaid: false, devVars: new Map<string, string>()}
	}
	const effective: EffectiveEnv = loadEffectiveEnv(devPath, join(ROOT, '.env.local'))
	childEnvExtra = Object.fromEntries(effective.vars)
	for (const key of RESERVED_ENV_KEYS) {
		delete childEnvExtra[key]
	}
	return effective
}

/** Full child environment: process env + mid-run .env.local overlay + extras. */
export function spawnEnv(extra?: Record<string, string>) {
	return {...process.env, ...childEnvExtra, ...extra}
}

export function run(
	cmd: string,
	args: Array<string>,
	envExtra?: Record<string, string>,
	timeoutMs?: number,
): number {
	return helperRun(cmd, args, {
		env: spawnEnv(envExtra),
		timeoutMs,
		capture: isQuietMode(),
	})
}

/** Run a project script with the mid-run env overlay (migrations, route generation). */
export function runScript(pm: string, script: string, timeoutMs: number): number {
	return run(pm, ['run', script], undefined, timeoutMs)
}

export function runQuiet(cmd: string, args: Array<string>, timeoutMs?: number): number {
	return helperRunQuiet(cmd, args, timeoutMs, spawnEnv())
}

export function tryCapture(cmd: string, args: Array<string>): string | null {
	const options: CaptureOptions = {env: spawnEnv()}
	return helperTryCapture(cmd, args, options)
}

/**
 * First line that is all hex: a container id from `ps -q`. A stray warning
 * on stdout must not misparse as the id or miss a reuse.
 */
export function findCidLine(out: string | null): string {
	if (out === null) {
		return ''
	}
	for (const line of out.split('\n')) {
		if (/^[0-9a-f]{12,64}$/i.test(line.trim())) {
			return line.trim()
		}
	}
	return ''
}

/**
 * First trailing `:port` across all lines (`0.0.0.0:5433`, `[::]:5433`).
 * The colon is required — bare trailing digits are not a port.
 */
export function findPort(out: string | null): string {
	if (out === null) {
		return ''
	}
	for (const line of out.split('\n')) {
		const port: string = line.match(/:(\d+)\s*$/)?.[1] ?? ''
		if (port !== '') {
			return port
		}
	}
	return ''
}

type MailpitReuse = {ownSmtpPort: string; ownHttpPort: string}

/**
 * Our own mailpit's mapped ports when its container is still up. Without
 * this ratchet guard a naive scan would read our own (possibly shifted)
 * ports as taken and shift again on every re-run.
 */
export function reuseMailpitPorts(): MailpitReuse {
	const mailpitCid: string = findCidLine(
		tryCapture('docker', ['compose', 'ps', '-q', '--all', 'mailpit']),
	)
	if (mailpitCid === '') {
		return {ownSmtpPort: '', ownHttpPort: ''}
	}
	const parsedSmtp: string = findPort(
		tryCapture('docker', ['compose', 'port', 'mailpit', String(MAILPIT_SMTP_WANT)]),
	)
	const parsedHttp: string = findPort(
		tryCapture('docker', ['compose', 'port', 'mailpit', String(MAILPIT_HTTP_WANT)]),
	)
	if (!/^\d+$/.test(parsedSmtp) || !/^\d+$/.test(parsedHttp)) {
		return {ownSmtpPort: '', ownHttpPort: ''}
	}
	return {ownSmtpPort: parsedSmtp, ownHttpPort: parsedHttp}
}

/**
 * Poll pg_isready until it answers: the shared readiness wait for fresh
 * and revived containers. Distinguishes a terminal container (fail fast)
 * from a still-starting one (timeout), never from a daemon hiccup.
 */
export async function waitForPostgres(
	cid: string,
	tries: number,
	withDots: boolean,
): Promise<'ready' | 'terminal' | 'timeout'> {
	let dots = false
	let outcome: 'terminal' | 'timeout' = 'timeout'
	for (let i = 0; i < tries; i += 1) {
		if (runQuiet('docker', ['exec', cid, 'pg_isready', '-U', 'postgres']) === 0) {
			if (dots) {
				console.error('')
			}
			return 'ready'
		}
		const state: string | null = tryCapture('docker', ['inspect', '-f', '{{.State.Status}}', cid])
		if (
			state === 'exited' ||
			state === 'dead' ||
			state === 'paused' ||
			state === 'removing' ||
			state === 'restarting'
		) {
			outcome = 'terminal'
			break
		}
		if (i < tries - 1) {
			await new Promise((resolve) => setTimeout(resolve, Math.min(1000 + i * 250, 3000)))
		}
		if (withDots && i % 5 === 4 && !isQuietMode() && process.stderr.isTTY) {
			process.stderr.write('.')
			dots = true
		}
	}
	if (dots) {
		console.error('')
	}
	return outcome
}

// One install-deps cleanup/install at a time per checkout. Cleanup renames
// node_modules and lockfiles, so two callers (agent-dev plus predev, or two
// agent starts) must never interleave. The second waits for the first to
// finish before touching the same paths. Dependency-free and synchronized
// across Node, Bun, and Nub.

import {randomUUID} from 'node:crypto'
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from 'node:fs'
import {join} from 'node:path'
import process from 'node:process'

import {fail, warn} from '../../helpers/output.ts'
import {ROOT} from '../../helpers/paths.ts'

const LOCK_DIR = join(ROOT, '.tmp', 'install-deps.lock')
const OWNER_FILE = 'owner.txt'
const WAIT_MS = 12 * 60 * 1000
const POLL_MS = 250

/** Longer than the install timeout, so a live holder is never reaped mid-install. */
const STALE_MS = 15 * 60 * 1000

/** A creator that died between mkdir and the owner write leaves no pid to probe. */
const OWNERLESS_STALE_MS = 30 * 1000

const sleepBuffer = new Int32Array(new SharedArrayBuffer(4))

type LockOwner = {pid: number; token: string; startedAt: number}

export type InstallLock = {release: () => void}

function sleep(milliseconds: number): void {
	Atomics.wait(sleepBuffer, 0, 0, milliseconds)
}

function readOwner(): LockOwner | null {
	let text: string

	try {
		text = readFileSync(join(LOCK_DIR, OWNER_FILE), 'utf8')
	} catch {
		return null
	}

	const [pidText, token, startedText] = text.split('\n')
	const pid: number = Number(pidText)
	const startedAt: number = Number(startedText)

	if (
		!Number.isSafeInteger(pid) ||
		pid <= 0 ||
		token === undefined ||
		token === '' ||
		!Number.isFinite(startedAt)
	) {
		return null
	}

	return {pid, token, startedAt}
}

function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0)

		return true
	} catch (error) {
		// SAFETY: node's process.kill throws an ErrnoException carrying a string code.
		return (error as {code?: string}).code === 'EPERM'
	}
}

function lockAge(owner: LockOwner | null): number {
	if (owner !== null) {
		return Math.max(0, Date.now() - owner.startedAt)
	}

	try {
		return Math.max(0, Date.now() - statSync(LOCK_DIR).mtimeMs)
	} catch {
		return 0
	}
}

function staleReason(owner: LockOwner | null, age: number): string | null {
	if (owner === null) {
		return age >= OWNERLESS_STALE_MS ? 'owner file is missing or unreadable' : null
	}

	if (!isPidAlive(owner.pid)) {
		return `owner pid ${owner.pid} is gone`
	}

	if (age >= STALE_MS) {
		return `owner pid ${owner.pid} exceeded ${Math.round(STALE_MS / 60_000)} minutes`
	}

	return null
}

/**
 * Move a stale lock aside atomically: two waiters can both decide to reap,
 * but only one rename wins. The loser retries acquisition normally.
 */
function reapStaleLock(): boolean {
	const tombstone: string = `${LOCK_DIR}.stale-${process.pid}-${randomUUID()}`

	try {
		renameSync(LOCK_DIR, tombstone)
	} catch {
		return false
	}

	try {
		rmSync(tombstone, {recursive: true, force: true})
	} catch {
		warn(`could not remove stale install-deps lock copy at ${tombstone}`)
	}

	return true
}

function releaseLock(token: string): void {
	if (!existsSync(LOCK_DIR)) {
		return
	}

	const owner: LockOwner | null = readOwner()

	if (owner === null || owner.token !== token) {
		warn('install-deps lock changed hands — leaving the new owner’s lock in place')

		return
	}

	try {
		rmSync(LOCK_DIR, {recursive: true, force: true})
	} catch {
		warn(`could not release .tmp/install-deps.lock — remove it if no install-deps is running`)
	}
}

/**
 * Acquire the checkout-wide install lock. Waits a bounded time for a live
 * holder; reaps a dead pid immediately and an ownerless/over-age lock after
 * a margin. `retry` is the copy-pasteable re-run hint for failures.
 */
export function acquireInstallLock(retry: string): InstallLock {
	try {
		mkdirSync(join(ROOT, '.tmp'), {recursive: true})
	} catch {
		fail(
			'could not create .tmp for the install-deps lock',
			`fix .tmp permissions, then re-run: ${retry}`,
		)
	}

	const token: string = randomUUID()
	const deadline: number = Date.now() + WAIT_MS
	let announcedPid: number | null = null

	for (;;) {
		try {
			mkdirSync(LOCK_DIR)

			const owner: LockOwner = {pid: process.pid, token, startedAt: Date.now()}

			try {
				writeFileSync(
					join(LOCK_DIR, OWNER_FILE),
					`${owner.pid}\n${owner.token}\n${owner.startedAt}\n`,
				)
			} catch {
				rmSync(LOCK_DIR, {recursive: true, force: true})
				fail(
					'could not write the install-deps lock owner',
					`fix .tmp permissions, then re-run: ${retry}`,
				)
			}

			return {release: () => releaseLock(token)}
		} catch (error) {
			if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) {
				fail(
					'could not acquire the install-deps lock',
					`fix .tmp permissions, then re-run: ${retry}`,
				)
			}
		}

		const owner: LockOwner | null = readOwner()
		const age: number = lockAge(owner)
		const stale: string | null = staleReason(owner, age)

		if (stale !== null && reapStaleLock()) {
			warn(`removed stale install-deps lock (${stale})`)

			continue
		}

		if (Date.now() >= deadline) {
			const holder: string = owner === null ? 'unknown pid' : `pid ${owner.pid}`

			fail(
				`timed out waiting for another install-deps run (${holder})`,
				`wait for it to finish, or delete .tmp/install-deps.lock if that process is gone; then re-run: ${retry}`,
			)
		}

		if (owner !== null && owner.pid !== announcedPid) {
			announcedPid = owner.pid
			warn(`waiting for another install-deps run (pid ${owner.pid}) to finish…`)
		}

		sleep(POLL_MS)
	}
}

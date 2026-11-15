// Rollback copies for install-deps cleanup. Moving the superseded files and
// node_modules aside (a same-filesystem rename, not a copy) makes a failed
// install non-destructive: the failed attempt's partial tree is removed and
// the previous dependency state comes back. The backup is deleted only after
// install succeeds.

import {randomUUID} from 'node:crypto'
import {existsSync, mkdirSync, renameSync, rmSync} from 'node:fs'
import {join, relative} from 'node:path'
import process from 'node:process'

import {fail, ok, warn} from '../../helpers/output.ts'
import {ROOT} from '../../helpers/paths.ts'

export type RollbackEntry = {path: string; backupPath: string}

export type Rollback = {
	root: string | null
	entries: Array<RollbackEntry>
	/** Paths the failed install may create and the restore must remove. */
	discard: Array<string>
	settled: boolean
}

function display(path: string): string {
	return relative(ROOT, path)
}

function restoreEntries(entries: Array<RollbackEntry>): Array<string> {
	const failed: Array<string> = []

	for (const entry of entries) {
		try {
			rmSync(join(ROOT, entry.path), {recursive: true, force: true})
			renameSync(entry.backupPath, join(ROOT, entry.path))
		} catch {
			failed.push(entry.path)
		}
	}

	return failed
}

/**
 * Rename every present path into a run-scoped .tmp backup. A failure before
 * install starts puts the already-moved entries back, so the caller either
 * gets a complete rollback or a clean failure with the originals in place.
 *
 * `discard` names paths the target install may create (its own lockfile):
 * a failed install removes them before restoring, so the checkout cannot end
 * up with two lockfiles and no manager to resolve it next run.
 */
export function moveAside(
	paths: Array<string>,
	retry: string,
	discard: Array<string> = [],
): Rollback {
	const present: Array<string> = paths.filter((path) => existsSync(join(ROOT, path)))

	if (present.length === 0) {
		return {root: null, entries: [], discard, settled: discard.length === 0}
	}

	const root: string = join(ROOT, '.tmp', `install-deps-backup-${process.pid}-${randomUUID()}`)

	try {
		mkdirSync(root, {recursive: true})
	} catch {
		fail(
			'could not create the install-deps rollback directory',
			`fix .tmp permissions, then re-run: ${retry}`,
		)
	}

	const entries: Array<RollbackEntry> = []
	let current: string | null = null

	try {
		for (const path of present) {
			current = path

			// Flatten path separators so a nested target still lands directly
			// inside the backup root.
			const backupPath: string = join(root, path.replaceAll('/', '__'))

			renameSync(join(ROOT, path), backupPath)
			entries.push({path, backupPath})
		}
	} catch {
		const failed: Array<string> = restoreEntries(entries)

		if (failed.length > 0) {
			fail(
				`could not move ${current ?? 'cleanup target'} aside, and could not restore ${failed.join(', ')}`,
				`originals are in ${display(root)}; restore them manually, then re-run: ${retry}`,
			)
		}

		rmSync(root, {recursive: true, force: true})

		fail(
			`could not move ${current ?? 'cleanup target'} aside`,
			`check .tmp permissions, then re-run: ${retry}`,
		)
	}

	return {root, entries, discard, settled: false}
}

function removeDiscard(discard: Array<string>): Array<string> {
	const removed: Array<string> = []

	for (const path of discard) {
		if (!existsSync(join(ROOT, path))) {
			continue
		}

		try {
			rmSync(join(ROOT, path), {recursive: true, force: true})
			removed.push(path)
		} catch {
			warn(`could not remove the failed install’s ${path}`)
		}
	}

	return removed
}

/** Put the previous checkout state back; used on any failure after cleanup. */
export function restoreRollback(rollback: Rollback): void {
	if (rollback.settled) {
		return
	}

	rollback.settled = true

	const removed: Array<string> = removeDiscard(rollback.discard)

	if (removed.length > 0) {
		ok(`removed newly created ${removed.join(', ')} after the failed install`)
	}

	if (rollback.root === null) {
		return
	}

	const failed: Array<string> = restoreEntries(rollback.entries)

	if (failed.length > 0) {
		warn(`could not restore ${failed.join(', ')} — originals are in ${display(rollback.root)}`)

		return
	}

	try {
		rmSync(rollback.root, {recursive: true, force: true})
	} catch {
		warn(`could not remove the empty rollback directory ${display(rollback.root)}`)
	}

	if (rollback.entries.length > 0) {
		ok(
			`restored ${rollback.entries.map((entry) => entry.path).join(', ')} after the failed install`,
		)
	}
}

/** Install succeeded: the moved-aside state is superseded, so drop it. */
export function commitRollback(rollback: Rollback): void {
	if (rollback.settled) {
		return
	}

	rollback.settled = true

	if (rollback.root === null) {
		return
	}

	try {
		rmSync(rollback.root, {recursive: true, force: true})
	} catch {
		warn(`could not remove the superseded rollback copy at ${display(rollback.root)}`)
	}
}

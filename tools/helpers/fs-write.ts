// Atomic file writes shared by the phase programs: a crash or ENOSPC
// mid-write must not leave a half-written committed file or .env.local.

import {chmodSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync} from 'node:fs'
import process from 'node:process'

import {fail} from './output.ts'

/**
 * Atomic tmp-write-rename. mode 'inherit' keeps the replaced file's mode
 * (committed project files); a number sets it (secrets: mode on creation,
 * so a fresh .env.local is never world-readable even briefly). PID-suffixed
 * so two concurrent runs in one worktree do not share a tmp path.
 */
export function writeFileAtomic(path: string, content: string, mode: number | 'inherit'): void {
	const tmpPath = `${path}.${process.pid}.tmp`
	try {
		if (mode === 'inherit') {
			writeFileSync(tmpPath, content)
		} else {
			writeFileSync(tmpPath, content, {mode})
		}
	} catch {
		try {
			unlinkSync(tmpPath)
		} catch {
			// Best effort; a stale tmp file is gitignored litter.
		}
		fail(`could not write ${path}`, 'is the disk full or read-only? free up space, then re-run')
	}
	try {
		chmodSync(tmpPath, mode === 'inherit' ? statSync(path).mode : mode)
	} catch {
		// New file or exotic FS: the tmp default (or creation) mode stands.
	}
	try {
		renameSync(tmpPath, path)
	} catch {
		try {
			unlinkSync(tmpPath)
		} catch {
			// Best effort; stale tmp litter beats a half-written file.
		}
		fail(`could not write ${path}`, 'is the disk full or read-only? free up space, then re-run')
	}
}

/** Write only when the content differs (timestamp stability): true when a write happened. */
export function writeFileIfChanged(path: string, content: string): boolean {
	let current: string | null
	try {
		current = readFileSync(path, 'utf8')
	} catch {
		current = null
	}
	if (current === content) {
		return false
	}
	writeFileAtomic(path, content, 'inherit')
	return true
}

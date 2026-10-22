/* oxlint-disable anti-slop/no-runtime-typeof -- npm lockfiles are untyped JSON; typeof narrowing at the boundary is the parse */
/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- npm lockfiles are untyped JSON by nature */

// Checkout dependency state: lockfile root-name drift and the mtime-based
// freshness boundary. Shared so install-deps, branch-env, and validate-setup
// agree on staleness.

import {readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'

import type {Pm} from './package-manager.ts'
import {lockfileFor} from './package-manager.ts'
import {ROOT} from './paths.ts'
import {readPackageJson} from './project-files.ts'

export type Freshness = {fresh: boolean; reason: string}

export type StaleLockfile = {file: string; lockName: string; packageName: string}

/** Root package name stored in npm or Bun lockfiles; null when unavailable. */
function lockfileRootName(pm: Pm): string | null {
	const path: string = join(ROOT, lockfileFor(pm))
	let text: string
	try {
		text = readFileSync(path, 'utf8')
	} catch {
		return null
	}
	if (pm === 'npm') {
		let parsed: unknown
		try {
			parsed = JSON.parse(text)
		} catch {
			return null
		}
		if (typeof parsed !== 'object' || parsed === null) {
			return null
		}
		// SAFETY: the object guard above narrows JSON.parse's unknown.
		const packages: unknown = (parsed as Record<string, unknown>)['packages']
		if (typeof packages === 'object' && packages !== null) {
			// SAFETY: the object guard above narrows the packages entry.
			const root: unknown = (packages as Record<string, unknown>)['']
			if (typeof root === 'object' && root !== null) {
				// SAFETY: the object guard above narrows the root package entry.
				const name: unknown = (root as Record<string, unknown>)['name']
				if (typeof name === 'string') {
					return name
				}
			}
		}
		// SAFETY: the object guard above narrows JSON.parse's unknown.
		const name: unknown = (parsed as Record<string, unknown>)['name']
		return typeof name === 'string' ? name : null
	}
	if (pm === 'bun') {
		const match: RegExpExecArray | null =
			/"workspaces"\s*:\s*\{\s*""\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]*)"/.exec(text)
		return match?.[1] ?? null
	}
	return null
}

/** A lockfile whose root name no longer matches package.json. */
export function staleLockfileName(pm: Pm): StaleLockfile | null {
	const pkg = readPackageJson()
	if (!pkg.ok || pkg.file.name === '') {
		return null
	}
	// Only npm and bun embed the root name in their lockfiles (npm:
	// packages[""].name; bun: workspaces[""].name). yarn.lock,
	// pnpm-lock.yaml, and nub.lock (pnpm v9 bytes) carry no root name, so a
	// rename can never stale them and there is nothing to regenerate — null
	// is the correct answer, not a gap. If aube's format embeds the name,
	// parse it here.
	const lockName: string | null = lockfileRootName(pm)
	if (lockName === null || lockName === pkg.file.name) {
		return null
	}
	return {file: lockfileFor(pm), lockName, packageName: pkg.file.name}
}

export function dependencyFreshness(pm: Pm): Freshness {
	const lockfile: string = lockfileFor(pm)
	let nmTime: number
	try {
		nmTime = statSync(join(ROOT, 'node_modules')).mtimeMs
	} catch {
		return {fresh: false, reason: 'node_modules is not installed'}
	}
	let lockTime: number
	try {
		lockTime = statSync(join(ROOT, lockfile)).mtimeMs
	} catch {
		return {fresh: false, reason: `${lockfile} is missing`}
	}
	let pkgTime: number
	try {
		pkgTime = statSync(join(ROOT, 'package.json')).mtimeMs
	} catch {
		return {fresh: false, reason: 'package.json is unreadable'}
	}
	const stale: StaleLockfile | null = staleLockfileName(pm)
	if (stale !== null) {
		return {
			fresh: false,
			reason: `${stale.file} still names '${stale.lockName}' (package.json says '${stale.packageName}')`,
		}
	}
	if (nmTime < lockTime) {
		return {fresh: false, reason: `node_modules is older than ${lockfile}`}
	}
	if (nmTime < pkgTime) {
		return {fresh: false, reason: 'node_modules is older than package.json'}
	}
	return {
		fresh: true,
		reason: `node_modules is newer than ${lockfile} and package.json (remove node_modules to force a reinstall)`,
	}
}

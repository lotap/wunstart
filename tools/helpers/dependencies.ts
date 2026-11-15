/* oxlint-disable anti-slop/no-runtime-typeof -- npm lockfiles are untyped JSON; typeof narrowing at the boundary is the parse */
/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- npm lockfiles are untyped JSON by nature */

// Checkout dependency state: lockfile root-name drift, the mtime-based
// freshness boundary, and node_modules ownership. Shared so install-deps,
// branch-env, and validate-setup agree on staleness.

import {existsSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'

import type {Pm} from './package-manager.ts'
import {lockfileFor} from './package-manager.ts'
import {ROOT} from './paths.ts'
import {readPackageJson} from './project-files.ts'

export type Freshness = {fresh: boolean; reason: string}

export type StaleLockfile = {file: string; lockName: string; packageName: string}

export type ForeignNodeModules = {pm: Pm; marker: string}

/**
 * node_modules markers each manager leaves behind (satisfies keeps the map
 * exhaustive over Pm; managers with no known marker map to none). Bun
 * leaves no distinctive marker, so a bun-installed tree inside a
 * foreign-manager checkout stays invisible — the guarded direction is
 * foreign markers inside this checkout, which is how a silent manager
 * swap (e.g. a vendored test spawning `pnpm exec`) announces itself.
 *
 * `.modules.yaml` is shared: pnpm writes it, and aube and Nub also write it
 * as Vite compatibility metadata. The selected manager’s own marker wins
 * before any foreign marker is considered, so a normal aube install (or a
 * Nub install with a project-local store) is not reported foreign merely
 * because an older `.pnpm` virtual store remains. `.store` only reliably
 * marks Nub trees built with a project-side virtual store (`nub ci`, CI, or
 * `enableGlobalVirtualStore=false`): the default local install links from a
 * machine-global virtual store, so `.modules.yaml` is the only project-side
 * marker of a healthy Nub tree. It therefore never labels a Nub target as
 * foreign; strong foreign markers such as `.pnpm` still do.
 */
const NODE_MODULES_MARKERS = {
	bun: [],
	npm: ['.package-lock.json'],
	yarn: ['.yarn-integrity', '.yarn-state.yml'],
	pnpm: ['.pnpm'],
	aube: ['.aube-state', '.aube'],
	nub: ['.store'],
} satisfies Record<Pm, Array<string>>

/**
 * Foreign-marker order for the remaining managers: aube/Nub state outranks
 * a virtual-store directory, so a stale `.pnpm` left by an earlier install
 * does not hide the tree that replaced it. The selected manager’s own
 * marker check above still wins over every foreign entry.
 */
const NODE_MODULES_MARKER_ORDER: Array<Pm> = ['aube', 'nub', 'pnpm', 'npm', 'yarn', 'bun']

const PNPM_COMPAT_MARKER = '.modules.yaml'

/** Another manager's leftovers inside node_modules, or null when owned. */
export function foreignNodeModules(pm: Pm): ForeignNodeModules | null {
	// The chosen manager’s own marker proves ownership first. Mixed trees are
	// ambiguous by nature; preferring the target avoids reporting a clean
	// aube/Nub install as foreign because a `.pnpm` directory survived.
	for (const marker of NODE_MODULES_MARKERS[pm]) {
		if (existsSync(join(ROOT, 'node_modules', marker))) {
			return null
		}
	}

	for (const other of NODE_MODULES_MARKER_ORDER) {
		if (other === pm) {
			continue
		}

		for (const marker of NODE_MODULES_MARKERS[other]) {
			if (existsSync(join(ROOT, 'node_modules', marker))) {
				return {pm: other, marker}
			}
		}
	}

	// Fallback for custom virtual-store layouts: pnpm’s real marker is
	// `.pnpm`, so the shared Vite file only identifies pnpm when no manager’s
	// own state is present and the target is neither pnpm nor Nub. Both write
	// the file themselves; for Nub it is the sole local marker (its virtual
	// store is machine-global), so it is ownership evidence, not a pnpm
	// leftover. What remains is a pnpm tree with a custom virtual-store name
	// inside a bun/npm/yarn/aube checkout.
	if (pm !== 'pnpm' && pm !== 'nub' && existsSync(join(ROOT, 'node_modules', PNPM_COMPAT_MARKER))) {
		return {pm: 'pnpm', marker: PNPM_COMPAT_MARKER}
	}

	return null
}

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

	// Ownership precedes mtime: a foreign-managed tree is newer than the
	// lockfile by construction (the swap just wrote it), so the clocks
	// below would vouch for it.
	const foreign: ForeignNodeModules | null = foreignNodeModules(pm)

	if (foreign !== null) {
		return {
			fresh: false,
			reason: `node_modules belongs to ${foreign.pm} (${join('node_modules', foreign.marker)} is present) but ${lockfile} says ${pm} — remove node_modules and reinstall`,
		}
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

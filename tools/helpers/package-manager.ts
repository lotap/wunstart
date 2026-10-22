// Package-manager domain plus tool install hints, shared across the setup
// phase programs and validate-setup. Leaf module (node builtins + the paths
// anchor) so consumers can import it without a layering cycle.

import {existsSync} from 'node:fs'
import {join} from 'node:path'

import {ROOT} from './paths.ts'

export type Pm = 'bun' | 'npm' | 'yarn' | 'pnpm' | 'aube' | 'nub'

/** The committed lockfile's manager: the default for a fresh tree. */
export const KIT_PM: Pm = 'bun'

/** Package managers a phase can install with (presence probed, never assumed). */
export const PM_TOOLS: Array<Pm> = [KIT_PM, 'npm', 'yarn', 'pnpm', 'aube', 'nub']

/**
 * Lockfile per package manager (satisfies, not a chain: a new Pm without a
 * lockfile fails the build instead of mis-checking freshness).
 */
export const LOCKFILES = {
	bun: 'bun.lock',
	npm: 'package-lock.json',
	yarn: 'yarn.lock',
	pnpm: 'pnpm-lock.yaml',
	aube: 'aube-lock.yaml',
	nub: 'nub.lock',
} satisfies Record<Pm, string>

const INSTALL_HINTS = new Map<string, string>([
	['bun', 'install bun: https://bun.sh — then re-run this script'],
	['npm', 'install node 22.18+ (npm ships with it) — then re-run this script'],
	['yarn', 'install yarn: npm i -g yarn — then re-run this script'],
	['pnpm', 'install pnpm: npm i -g pnpm — then re-run this script'],
	['aube', 'install aube: mise use -g aube (https://aube.sh) — then re-run this script'],
	['nub', 'install nub: npm i -g @nubjs/nub (https://nubjs.com) — then re-run this script'],
	[
		'docker',
		'install Docker Desktop (https://docker.com/products/docker-desktop) or the docker engine — then re-run this script',
	],
])

/** Where to get a missing tool binary (same voice as the fail hints). */
export function installHint(tool: string): string {
	return INSTALL_HINTS.get(tool) ?? 'install node 22.18+ — then re-run this script'
}

/** Lockfile a manager writes. */
export function lockfileFor(pm: Pm): string {
	return LOCKFILES[pm]
}

/** Copy-pasteable `run <script>` for this manager. */
export function pmRun(pm: Pm, script: string): string {
	return pm === 'bun' ? `bun --bun run ${script}` : `${pm} run ${script}`
}

/**
 * Copy-pasteable phase command (`app-identity`, `install-deps`,
 * `branch-env`). These scripts choose their own runtime, so bun does not
 * need the `--bun` prefix.
 */
export function phaseCommand(pm: Pm | null, script: string): string {
	if (pm === null) {
		return `bun run ${script}`
	}
	return pm === 'bun' ? `bun run ${script}` : `${pm} run ${script}`
}

/**
 * Copy-pasteable phase command with args. npm is the only manager that
 * needs the explicit `--` separator to forward flags; every other manager
 * passes the args after the script name straight through. pnpm also echoes
 * the separator into the script's argv, which the phase parsers read as a
 * positional.
 */
export function phaseCommandWithArgs(pm: Pm, script: string, args: Array<string>): string {
	if (args.length === 0) {
		return phaseCommand(pm, script)
	}
	const tail: string = args.join(' ')
	return pm === 'npm' ? `${pm} run ${script} -- ${tail}` : `${pm} run ${script} ${tail}`
}

/**
 * Copy-pasteable phase example for `--help`: the checkout's manager when
 * detected, otherwise the kit default. Help text must never show a
 * manager the user doesn't use.
 */
export function phaseExample(pm: Pm | null, script: string, args: Array<string> = []): string {
	return phaseCommandWithArgs(pm ?? KIT_PM, script, args)
}

/**
 * Manager named by package.json's `packageManager` field (`pnpm@9.1.0`),
 * or null when absent/unrecognized.
 */
export function pmFromPackageManagerField(value: string | undefined): Pm | null {
	if (value === undefined || value === '') {
		return null
	}
	const at: number = value.indexOf('@')
	const name: string = at === -1 ? value : value.slice(0, at)
	return PM_TOOLS.find((tool) => tool === name) ?? null
}

export type PresentLockfile = {pm: Pm; file: string}

/** Every manager whose lockfile exists in this checkout. */
export function presentLockfiles(): Array<PresentLockfile> {
	const found: Array<PresentLockfile> = []
	for (const pm of PM_TOOLS) {
		const file: string = LOCKFILES[pm]
		if (existsSync(join(ROOT, file))) {
			found.push({pm, file})
		}
	}
	return found
}

/**
 * Best-effort manager detection from this checkout's lockfiles (null when
 * zero or several match — hint sites fall back to neutral wording
 * instead of guessing).
 */
export function detectPm(): Pm | null {
	const found: Array<Pm> = PM_TOOLS.filter((tool) => existsSync(join(ROOT, LOCKFILES[tool])))
	return found.length === 1 ? (found[0] ?? null) : null
}

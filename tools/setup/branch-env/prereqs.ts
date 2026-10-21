// Prerequisite gates: branch-env never renames, installs, or repairs
// another phase's work. It reads observable state and fails with the exact
// command that does.

import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {join} from 'node:path'
import process from 'node:process'

import {isValidSlug} from '../../helpers/app-name.ts'
import {dependencyFreshness} from '../../helpers/dependencies.ts'
import {fail, ok, step, warn} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {
	detectPm,
	installHint,
	phaseCommand,
	pmFromPackageManagerField,
	PM_TOOLS,
	presentLockfiles,
} from '../../helpers/package-manager.ts'
import {ROOT} from '../../helpers/paths.ts'
import {killedBySigint} from '../../helpers/probe.ts'
import {hasCommand} from '../../helpers/process.ts'
import type {PackageJsonFile} from '../../helpers/project-files.ts'
import {
	readAppInfoFile,
	readPackageJson,
	readWorkerName,
	wasmState,
} from '../../helpers/project-files.ts'
import {runQuiet} from './process.ts'

/**
 * Hint commands resolve the manager fresh on every call: detection is five
 * stat calls, so there is nothing to cache — and a cached value could
 * disagree with a later `requireUnambiguousPm()` in the same run.
 */
function appIdentityCommand(): string {
	return phaseCommand(detectPm(), 'app-identity')
}

function installDepsCommand(): string {
	return phaseCommand(detectPm(), 'install-deps')
}

function readPackage(): PackageJsonFile {
	const pkg = readPackageJson()
	if (!pkg.ok) {
		const problem: string = pkg.reason === 'invalid' ? 'not valid JSON' : 'unreadable'
		fail(
			`package.json is ${problem}`,
			`restore it: git checkout -- package.json — then run: ${appIdentityCommand()}`,
		)
	}
	return pkg.file
}

/** Verify the identity files agree and carry a deployable slug. */
export function checkIdentity(): void {
	const pkg: PackageJsonFile = readPackage()
	const workerName: string | null = readWorkerName()
	const appInfo = readAppInfoFile()
	if (pkg.name === '') {
		fail('package.json has no app name', `run: ${appIdentityCommand()} — then re-run branch-env`)
	}
	const pkgProblem: string | null = isValidSlug(pkg.name)
	if (pkgProblem !== null) {
		fail(
			`package.json name '${pkg.name}' is not a valid app name (${pkgProblem})`,
			`run: ${appIdentityCommand()} — then re-run branch-env`,
		)
	}
	if (workerName === null) {
		fail(
			'wrangler.jsonc is missing, unreadable, or has no worker name',
			`restore it: git checkout -- wrangler.jsonc — then run: ${appIdentityCommand()}`,
		)
	}
	const workerProblem: string | null = isValidSlug(workerName)
	if (workerProblem !== null) {
		fail(
			`wrangler.jsonc worker name '${workerName}' is not a valid slug (${workerProblem})`,
			`run: ${appIdentityCommand()} — then re-run branch-env`,
		)
	}
	if (appInfo === null) {
		fail(
			'src/app-info.ts is missing or unreadable',
			'restore it: git checkout -- src/app-info.ts — then re-run branch-env',
		)
	}
	if (appInfo.name === undefined || appInfo.description === undefined) {
		fail(
			'src/app-info.ts is missing its name or description field',
			'restore it: git checkout -- src/app-info.ts — then re-run branch-env',
		)
	}
	const appInfoName: string = appInfo.name
	const appInfoProblem: string | null = isValidSlug(appInfoName)
	if (appInfoProblem !== null) {
		fail(
			`src/app-info.ts name '${appInfoName}' is not a valid slug (${appInfoProblem})`,
			`run: ${appIdentityCommand()} — then re-run branch-env`,
		)
	}
	if (pkg.name !== workerName || pkg.name !== appInfoName) {
		fail(
			`project identity is not synchronized (package.json: ${pkg.name}, wrangler.jsonc: ${workerName}, src/app-info.ts: ${appInfoName})`,
			`run: ${appIdentityCommand()} — then re-run branch-env`,
		)
	}
	ok(`identity ${pkg.name}`)
}

/**
 * Package manager from checkout evidence only. Lockfiles describe the
 * installed toolchain and win over a stale packageManager field; ambiguity
 * is install-deps' job to resolve. Named apart from install-deps'
 * resolvePm on purpose: that one prompts or fails with remediation, this
 * one only ever fails — sharing a name (or a function) would pretend the
 * two contracts agree.
 */
export function requireUnambiguousPm(): Pm {
	const pkg: PackageJsonFile = readPackage()
	const fieldPm: Pm | null = pmFromPackageManagerField(pkg.packageManager)
	if (pkg.packageManager !== undefined && fieldPm === null) {
		warn(
			`ignoring unrecognized packageManager field '${pkg.packageManager}' (want ${PM_TOOLS.join(', ')})`,
		)
	}
	const lockfiles = presentLockfiles()
	if (lockfiles.length > 1) {
		const files: string = lockfiles.map((lock) => lock.file).join(', ')
		fail(
			`package manager is ambiguous (multiple lockfiles: ${files})`,
			`run: ${installDepsCommand()} — then re-run branch-env`,
		)
	}
	if (lockfiles.length === 1) {
		const lock = lockfiles[0]
		if (lock === undefined) {
			fail('no lockfile identifies the package manager', `run: ${installDepsCommand()}`)
		}
		if (fieldPm !== null && fieldPm !== lock.pm) {
			warn(
				`ignoring packageManager '${pkg.packageManager ?? ''}' (using ${lock.pm} from lockfile evidence)`,
			)
		}
		if (!hasCommand(lock.pm)) {
			fail(`${lock.pm} is not installed`, installHint(lock.pm))
		}
		return lock.pm
	}
	if (fieldPm !== null) {
		if (!hasCommand(fieldPm)) {
			fail(`${fieldPm} is not installed`, installHint(fieldPm))
		}
		return fieldPm
	}
	fail(
		'no lockfile identifies the package manager',
		`run: ${installDepsCommand()} — then re-run branch-env`,
	)
}

/** Dependencies must exist and be newer than the lockfile and package.json. */
export function checkDependencies(pm: Pm): void {
	const rerun: string = phaseCommand(pm, 'install-deps')
	const freshness = dependencyFreshness(pm)
	if (!freshness.fresh) {
		fail(
			`dependencies are not fresh (${freshness.reason})`,
			`run: ${rerun} — then re-run branch-env`,
		)
	}
	ok('dependencies present and fresh')
}

/** Committed static files needed before provisioning; a miss is a restore case. */
export function checkProjectFiles(): void {
	const wasm = wasmState()
	if (wasm.bytes <= 0 || !wasm.present) {
		fail(
			'wasm kernel missing or unreadable (src/durable-objects/argon2-do-hasher.wasm)',
			'restore it: git checkout -- src/durable-objects/argon2-do-hasher.wasm — then re-run branch-env',
		)
	}
	if (!existsSync(join(ROOT, 'compose.yaml'))) {
		fail(
			'compose.yaml is missing',
			'restore it: git checkout -- compose.yaml — then re-run branch-env',
		)
	}
}

/** First non-empty stderr line; Docker puts the real permission/config reason there. */
function firstLine(text: string | null): string {
	const line: string | undefined = (text ?? '')
		.split('\n')
		.map((entry) => entry.trim())
		.find((entry) => entry !== '')
	return line ?? ''
}

export function checkDocker(): void {
	step('checking docker…')
	if (!hasCommand('docker')) {
		fail('docker is not installed', installHint('docker'))
	}
	const info = spawnSync('docker', ['info'], {
		stdio: ['ignore', 'ignore', 'pipe'],
		encoding: 'utf8',
		timeout: 45000,
	})
	if (killedBySigint(info.signal)) {
		process.exit(130)
	}
	if (info.status !== 0) {
		const detail: string = firstLine(info.stderr)
		const prefix: string = detail === '' ? '' : `docker said: ${detail} — `
		fail(
			'docker daemon is not reachable',
			`${prefix}start Docker Desktop (or dockerd) — then re-run branch-env`,
		)
	}
	ok('docker daemon reachable')
	if (runQuiet('docker', ['compose', 'version'], 15000) !== 0) {
		fail(
			'docker compose plugin is not installed',
			'install it (Docker Desktop includes it; on Linux install the docker-compose-plugin package) — then re-run branch-env',
		)
	}
}

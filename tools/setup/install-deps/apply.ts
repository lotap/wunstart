// install-deps actions: cleanup, install, and hooks. Every action is
// described by the plan first. Route generation is deliberately absent:
// routeTree.gen.ts carries the TanStack Start type registration, which only
// the dev/build server's plugin can emit — the tsr CLI would strip it.

import {existsSync, mkdirSync, utimesSync} from 'node:fs'
import {join} from 'node:path'
import process from 'node:process'

import {fail, isQuietMode, ok, step, warn} from '../../helpers/output.ts'
import {lockfileFor, phaseCommand, phaseCommandWithArgs} from '../../helpers/package-manager.ts'
import {ROOT} from '../../helpers/paths.ts'
import {run} from '../../helpers/process.ts'
import type {Rollback} from './backup.ts'
import {commitRollback, moveAside, restoreRollback} from './backup.ts'
import {acquireInstallLock} from './lock.ts'
import type {InstallPlan} from './plan.ts'
import {cleanupList} from './plan.ts'

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000
const HOOKS_TIMEOUT_MS = 60 * 1000

/**
 * pnpm records these approvals in pnpm-workspace.yaml during the install, so
 * a switch leaves a working allowBuilds set without a tracked file.
 */
const PNPM_INSTALL_ARGS: Array<string> = [
	'install',
	'--allow-build=esbuild',
	'--allow-build=workerd',
]

/** Workspace files an install may generate to record build approvals. */
const WORKSPACE_FILES: Array<string> = ['pnpm-workspace.yaml', 'aube-workspace.yaml']

export function applyPlan(plan: InstallPlan): void {
	const retry: string = phaseCommandWithArgs(plan.pm, 'install-deps', ['--pm', plan.pm])
	const lock = acquireInstallLock(retry)
	let rollback: Rollback | null = null

	const onExit = () => {
		if (rollback !== null) {
			restoreRollback(rollback)
		}

		lock.release()
	}

	// `run` exits directly on SIGINT (and `fail` exits on install errors).
	// The exit hook is the last chance to put node_modules and lockfiles back
	// before the process ends; the normal finally below covers throws.
	process.on('exit', onExit)

	try {
		const cleanupPaths: Array<string> = [
			...cleanupList(plan),
			...(plan.staleLockfile === null ? [] : [plan.staleLockfile]),
		]

		// A missing (or stale, already moved-aside) target lockfile is created
		// by the install and must not survive a failure; an existing current
		// lockfile is the user's state and stays untouched. A workspace file
		// the switch generates follows the same rule: discard it on failure,
		// but never one that existed before cleanup.
		const targetLockfile: string = lockfileFor(plan.pm)

		const discard: Array<string> = [
			...(plan.staleLockfile === targetLockfile || !existsSync(join(ROOT, targetLockfile))
				? [targetLockfile]
				: []),
			...WORKSPACE_FILES.filter((file) => !existsSync(join(ROOT, file))),
		]

		const current: Rollback = moveAside(cleanupPaths, retry, discard)

		rollback = current

		for (const entry of current.entries) {
			ok(`moved ${entry.path} aside (superseded by ${plan.pm}; restored if install fails)`)
		}

		if (plan.install) {
			step(`installing dependencies with ${plan.pm}…`)

			const installArgs: Array<string> = plan.pm === 'pnpm' ? PNPM_INSTALL_ARGS : ['install']

			if (
				run(plan.pm, installArgs, {timeoutMs: INSTALL_TIMEOUT_MS, capture: isQuietMode()}) !== 0
			) {
				restoreRollback(current)
				fail(
					`${plan.pm} install failed`,
					`the previous dependency state was restored — see the output above, then re-run: ${retry}`,
				)
			}

			ok('dependencies installed')
		} else {
			ok('dependencies already installed')
		}

		commitRollback(current)

		// Record freshness on the checkout's own node_modules: a no-op install
		// may leave its directory mtime untouched, and branch-env uses that
		// mtime as the observable staleness boundary.
		try {
			mkdirSync(join(ROOT, 'node_modules'), {recursive: true})
			const now = new Date()
			utimesSync(join(ROOT, 'node_modules'), now, now)
		} catch {
			warn(
				'could not update node_modules freshness timestamp — branch-env may ask for install-deps again',
			)
		}

		const hooks: string = join(ROOT, 'tools', 'pkg-scripts', 'setup-git-hooks.sh')

		if (run('sh', [hooks], {timeoutMs: HOOKS_TIMEOUT_MS, capture: isQuietMode()}) !== 0) {
			warn(`git hooks did not install — re-run: ${phaseCommand(plan.pm, 'setup:hooks')}`)
		}
	} finally {
		process.off('exit', onExit)

		if (rollback !== null) {
			restoreRollback(rollback)
		}

		lock.release()
	}
}

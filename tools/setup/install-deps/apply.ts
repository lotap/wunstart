// install-deps actions: cleanup, install, and hooks. Every action is
// described by the plan first. Route generation is deliberately absent:
// routeTree.gen.ts carries the TanStack Start type registration, which only
// the dev/build server's plugin can emit — the tsr CLI would strip it.

import {mkdirSync, rmSync, utimesSync} from 'node:fs'
import {join} from 'node:path'

import {fail, isQuietMode, ok, step, warn} from '../../helpers/output.ts'
import {phaseCommand, phaseCommandWithArgs} from '../../helpers/package-manager.ts'
import {ROOT} from '../../helpers/paths.ts'
import {run} from '../../helpers/process.ts'
import type {InstallPlan} from './plan.ts'

const INSTALL_TIMEOUT_MS = 10 * 60 * 1000
const HOOKS_TIMEOUT_MS = 60 * 1000

function removeFile(file: string, label: string, retry: string): void {
	try {
		// force: an already-missing file is the desired state, not a warning;
		// any other failure leaves a conflicting toolchain, so it is fatal.
		rmSync(join(ROOT, file), {force: true})
		ok(label)
	} catch {
		fail(`could not remove ${file}`, `delete it manually, then re-run: ${retry}`)
	}
}

function cleanup(plan: InstallPlan, retry: string): void {
	for (const file of plan.foreignLockfiles) {
		removeFile(file, `removed stale ${file} (superseded by ${plan.pm})`, retry)
	}
	if (plan.staleLockfile !== null) {
		removeFile(
			plan.staleLockfile,
			`removed ${plan.staleLockfile} (stale package name; install regenerates it)`,
			retry,
		)
	}
	if (plan.workspace === 'drop') {
		removeFile('pnpm-workspace.yaml', 'removed pnpm-workspace.yaml (leaving pnpm)', retry)
	}
	if (plan.removeNodeModules) {
		try {
			rmSync(join(ROOT, 'node_modules'), {recursive: true, force: true})
			ok(`removed node_modules (incompatible with ${plan.pm}) — reinstalling`)
		} catch {
			fail('could not remove node_modules', `delete it manually, then re-run: ${retry}`)
		}
	}
}

export function applyPlan(plan: InstallPlan): void {
	const retry: string = phaseCommandWithArgs(plan.pm, 'install-deps', ['--pm', plan.pm])
	cleanup(plan, retry)
	if (plan.install) {
		step(`installing dependencies with ${plan.pm}…`)
		if (run(plan.pm, ['install'], {timeoutMs: INSTALL_TIMEOUT_MS, capture: isQuietMode()}) !== 0) {
			fail(`${plan.pm} install failed`, `see the output above, then re-run: ${retry}`)
		}
		ok('dependencies installed')
	} else {
		ok('dependencies already installed')
	}
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
}

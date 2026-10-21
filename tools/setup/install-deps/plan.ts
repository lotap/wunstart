// install-deps plan assembly and human-readable output. The plan is built
// after the workspace decision so it promises exactly what apply runs.

import type {Freshness} from '../../helpers/dependencies.ts'
import {dependencyFreshness, staleLockfileName} from '../../helpers/dependencies.ts'
import {isQuietMode} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {phaseCommand} from '../../helpers/package-manager.ts'
import type {Evidence} from './evidence.ts'
import type {PmSource, WorkspaceAction} from './resolve.ts'

export type InstallPlan = {
	pm: Pm
	source: PmSource
	foreignLockfiles: Array<string>
	staleLockfile: string | null
	removeNodeModules: boolean
	workspace: WorkspaceAction
	install: boolean
	installReason: string
}

export type PlanInputs = {
	pm: Pm
	source: PmSource
	foreignLockfiles: Array<string>
	staleLockfile: string | null
	removeNodeModules: boolean
	workspace: WorkspaceAction
	freshness: Freshness
}

export function buildPlan(inputs: PlanInputs): InstallPlan {
	const {pm, source, foreignLockfiles, staleLockfile, removeNodeModules, workspace, freshness} =
		inputs
	const installReason: string =
		staleLockfile !== null ? `${staleLockfile} still names the old package` : freshness.reason
	return {
		pm,
		source,
		foreignLockfiles,
		staleLockfile,
		removeNodeModules,
		workspace,
		install: !freshness.fresh || staleLockfile !== null,
		installReason,
	}
}

export type DeriveInputs = {
	pm: Pm
	source: PmSource
	evidence: Evidence
	workspace: WorkspaceAction
}

/** Derive plan inputs from resolution + checkout evidence (main stays orchestration). */
export function derivePlanInputs(inputs: DeriveInputs): PlanInputs {
	const {pm, source, evidence, workspace} = inputs
	const foreignLockfiles: Array<string> = evidence.lockfiles
		.filter((lock) => lock.pm !== pm)
		.map((lock) => lock.file)
	const ownLockfile: boolean = evidence.lockfiles.some((lock) => lock.pm === pm)
	const stale = staleLockfileName(pm)
	const staleLockfile: string | null = stale === null ? null : stale.file
	const removeNodeModules: boolean =
		evidence.hasNodeModules && (foreignLockfiles.length > 0 || !ownLockfile)
	const freshness: Freshness = removeNodeModules
		? {
				fresh: false,
				reason: `node_modules will be removed for the ${pm} toolchain`,
			}
		: dependencyFreshness(pm)
	return {pm, source, foreignLockfiles, staleLockfile, removeNodeModules, workspace, freshness}
}

/** Keyed by source so a new resolution path fails the build instead of mislabelling. */
const SOURCE_LABELS = {
	'flag': '--pm',
	'packageManager': 'package.json packageManager',
	'lockfile': 'lockfile evidence',
	'workspace': 'pnpm-workspace.yaml evidence',
	'prompt': 'interactive choice',
	'fresh-default': 'fresh-tree default',
} satisfies Record<PmSource, string>

export type PlanDisplay = {dryRun: boolean; canPrompt: boolean}

/** Everything the plan removes, in apply order (plan display and result share it). */
function cleanupList(plan: InstallPlan): Array<string> {
	const cleanup: Array<string> = [...plan.foreignLockfiles]
	if (plan.workspace === 'drop') {
		cleanup.push('pnpm-workspace.yaml')
	}
	if (plan.removeNodeModules) {
		cleanup.push('node_modules')
	}
	return cleanup
}

export function printPlan(plan: InstallPlan, display: PlanDisplay): void {
	// A dry-run plan is the command's primary output (stdout, pipeable),
	// not chatter: --quiet suppresses progress, never the plan itself.
	if (isQuietMode() && !display.canPrompt && !display.dryRun) {
		return
	}
	const cleanup: Array<string> = cleanupList(plan)
	const lines: Array<string> = [
		`  package manager: ${plan.pm} (${SOURCE_LABELS[plan.source]})`,
		`  install:         ${plan.install ? `yes — ${plan.installReason}` : `skip — ${plan.installReason}`}`,
	]
	if (cleanup.length > 0) {
		lines.push(`  cleanup:         remove ${cleanup.join(', ')} (superseded by ${plan.pm})`)
	} else {
		lines.push('  cleanup:         none')
	}
	if (plan.staleLockfile !== null) {
		lines.push(
			`  lockfile:        remove ${plan.staleLockfile} (stale package name; install regenerates it)`,
		)
	}
	if (plan.workspace === 'keep' && plan.pm !== 'pnpm') {
		lines.push(
			'  workspace:       keep pnpm-workspace.yaml (pass --force or re-run interactively to remove it)',
		)
	}
	lines.push('  hooks:           install git hooks (warn-only)')
	const header: string = display.dryRun ? 'plan (nothing changed):' : 'plan:'
	// Dry-run plans are the pipeable primary output (stdout); every other
	// plan goes to stderr so it never pollutes a stdout pipe.
	const write: (message: string) => void = display.dryRun ? console.log : console.error
	write(`${header}\n${lines.join('\n')}`)
}

export function printResult(plan: InstallPlan): void {
	if (isQuietMode()) {
		return
	}
	const removed: Array<string> = cleanupList(plan)
	const lines: Array<string> = [
		`  toolchain  ${plan.pm}`,
		`  install    ${plan.install ? `yes — ${plan.installReason}` : `skip — ${plan.installReason}`}`,
		removed.length > 0 ? `  cleanup    removed ${removed.join(', ')}` : '  cleanup    none',
	]
	console.log(
		`\ninstall-deps complete — next: ${phaseCommand(plan.pm, 'branch-env')}\n${lines.join('\n')}`,
	)
}

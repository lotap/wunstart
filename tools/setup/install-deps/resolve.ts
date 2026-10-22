// Toolchain and workspace-config resolution from explicit flags and
// checkout evidence. No remembered answers: the tree either identifies a
// manager or the run prompts/fails with the exact remediation.

import {fail, warn} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {
	KIT_PM,
	PM_TOOLS,
	installHint,
	pmFromPackageManagerField,
} from '../../helpers/package-manager.ts'
import {hasCommand} from '../../helpers/process.ts'
import type {Asker} from '../../helpers/prompt.ts'
import {confirmValidator} from '../../helpers/prompt.ts'
import type {Evidence} from './evidence.ts'

export type PmSource =
	| 'flag'
	| 'packageManager'
	| 'lockfile'
	| 'workspace'
	| 'fresh-default'
	| 'prompt'

export type PmResolution = {
	pm: Pm
	source: PmSource
}

export type WorkspaceAction = 'none' | 'keep' | 'drop'

type WorkspaceInputs = {
	evidence: Evidence
	pm: Pm
	source: PmSource
	force: boolean
	canPrompt: boolean
	ask: Asker['ask']
}

function installedPms(): Array<Pm> {
	return PM_TOOLS.filter((pm) => hasCommand(pm))
}

function ambiguousHint(): string {
	return `choose one explicitly: bun run install-deps --pm ${PM_TOOLS.join('|')}`
}

async function askPm(ask: Asker['ask']): Promise<Pm> {
	const present: Array<Pm> = installedPms()

	if (present.length === 0) {
		fail('no package manager is installed', installHint(KIT_PM))
	}

	const answer: string = await ask(`Package manager (${PM_TOOLS.join(', ')})`, {
		defaultValue: present[0] ?? KIT_PM,
		validate: (value: string) => {
			const normalized: string = value.toLowerCase()

			if (PM_TOOLS.find((tool) => tool === normalized) === undefined) {
				return `choose ${PM_TOOLS.join(', ')}`
			}

			return hasCommand(normalized) ? null : `${normalized} is not installed`
		},
	})

	const found: Pm | undefined = PM_TOOLS.find((tool) => tool === answer.toLowerCase())

	if (found === undefined) {
		fail(`unknown package manager: ${answer}`, ambiguousHint())
	}

	return found
}

async function resolveAmbiguous(
	reason: string,
	canPrompt: boolean,
	ask: Asker['ask'],
): Promise<Pm> {
	if (!canPrompt) {
		fail(`package manager is ambiguous: ${reason} — refusing to guess`, ambiguousHint())
	}

	return askPm(ask)
}

type PmInputs = {
	cliPm: Pm | undefined
	evidence: Evidence
	canPrompt: boolean
	dryRun: boolean
	ask: Asker['ask']
}

export async function resolvePm(inputs: PmInputs): Promise<PmResolution> {
	const {cliPm, evidence, canPrompt, dryRun, ask} = inputs
	const fieldPm: Pm | null = pmFromPackageManagerField(evidence.packageManagerField)

	if (evidence.packageManagerField !== undefined && fieldPm === null) {
		warn(
			`ignoring unrecognized packageManager field '${evidence.packageManagerField}' (want ${PM_TOOLS.join(', ')})`,
		)
	}

	let pm: Pm
	let source: PmSource

	if (cliPm !== undefined) {
		pm = cliPm
		source = 'flag'
	} else if (evidence.lockfiles.length === 1) {
		pm = evidence.lockfiles[0]?.pm ?? KIT_PM
		source = 'lockfile'
	} else if (evidence.lockfiles.length > 1) {
		const files: string = evidence.lockfiles.map((lock) => lock.file).join(', ')
		pm = await resolveAmbiguous(`multiple lockfiles (${files})`, canPrompt, ask)
		source = 'prompt'
	} else if (fieldPm !== null) {
		pm = fieldPm
		source = 'packageManager'
	} else if (evidence.hasNodeModules) {
		pm = await resolveAmbiguous(
			'node_modules exists but no lockfile identifies its manager',
			canPrompt,
			ask,
		)
		source = 'prompt'
	} else if (evidence.hasPnpmWorkspace) {
		pm = 'pnpm'
		source = 'workspace'
	} else if (hasCommand(KIT_PM)) {
		pm = KIT_PM
		source = 'fresh-default'
	} else {
		const present: Array<Pm> = installedPms()

		if (present.length === 1) {
			pm = present[0] ?? KIT_PM
			source = 'fresh-default'
		} else if (present.length === 0) {
			if (dryRun) {
				warn(`no package manager is installed — dry-run plan uses ${KIT_PM}`)
				pm = KIT_PM
				source = 'fresh-default'
			} else {
				fail('no package manager is installed', installHint(KIT_PM))
			}
		} else {
			pm = await resolveAmbiguous(
				'multiple package managers are installed and the tree has no lockfile',
				canPrompt,
				ask,
			)
			source = 'prompt'
		}
	}

	if (fieldPm !== null && fieldPm !== pm) {
		warn(`ignoring packageManager '${evidence.packageManagerField ?? ''}' (using ${pm})`)
	}

	if (!hasCommand(pm)) {
		if (dryRun) {
			warn(`${pm} is not installed — dry-run plan only`)
		} else {
			fail(`${pm} is not installed`, installHint(pm))
		}
	}

	return {pm, source}
}

/**
 * Workspace-file decision: pnpm-workspace.yaml is pnpm-only config, kept
 * unless the user is leaving pnpm and consents to its removal (answered
 * prompt or --force). --force never deletes the active manager's config.
 */
export async function resolveWorkspace(inputs: WorkspaceInputs): Promise<WorkspaceAction> {
	const {evidence, pm, source, force, canPrompt, ask} = inputs

	if (!evidence.hasPnpmWorkspace) {
		return 'none'
	}

	if (pm === 'pnpm') {
		return 'keep'
	}

	const leavingPnpm: boolean =
		evidence.lockfiles.some((lock) => lock.pm === 'pnpm') ||
		source === 'flag' ||
		source === 'packageManager'

	if (!leavingPnpm) {
		return 'keep'
	}

	if (canPrompt) {
		const answer: string = await ask(
			'pnpm-workspace.yaml is pnpm-only config (kept if you return to pnpm); delete it? (y/N)',
			{
				defaultValue: 'n',
				validate: confirmValidator('n'),
			},
		)

		return answer.toLowerCase().startsWith('y') ? 'drop' : 'keep'
	}

	if (force) {
		return 'drop'
	}

	warn(
		'keeping pnpm-workspace.yaml (leaving pnpm; re-run interactively to decide, or pass --force to remove it)',
	)

	return 'keep'
}

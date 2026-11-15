// Toolchain and workspace-config resolution from explicit flags and
// checkout evidence. No remembered answers: the tree either identifies a
// manager or the run prompts/fails with the exact remediation.

import {fail, warn} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {
	KIT_PM,
	PM_TOOLS,
	installHint,
	phaseCommandWithArgs,
	pmFromPackageManagerField,
} from '../../helpers/package-manager.ts'
import {hasCommand, tryCapture} from '../../helpers/process.ts'
import type {Asker} from '../../helpers/prompt.ts'
import {confirmValidator} from '../../helpers/prompt.ts'
import type {Evidence} from './evidence.ts'

export type PmSource = 'flag' | 'packageManager' | 'lockfile' | 'fresh-default' | 'prompt'

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
	return `choose one explicitly: pass --pm ${PM_TOOLS.join('|')} to this checkout’s install-deps script`
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

/**
 * pnpm added `--allow-build` in 12.7.0. apply.ts passes it so the install can
 * record the esbuild/workerd build approvals; older pnpm rejects the flag, so
 * a switch could never succeed.
 */
const PNPM_MINIMUM_MAJOR = 12
const PNPM_MINIMUM_MINOR = 7

/** Below 12.7? Unreadable output returns false: presence is hasCommand’s job. */
function pnpmTooOld(version: string): boolean {
	const match: RegExpExecArray | null = /(\d+)\.(\d+)/.exec(version)

	if (match === null) {
		return false
	}

	const major: number = Number(match[1])
	const minor: number = Number(match[2])

	return major < PNPM_MINIMUM_MAJOR || (major === PNPM_MINIMUM_MAJOR && minor < PNPM_MINIMUM_MINOR)
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
		if (cliPm === undefined) {
			warn(`ignoring packageManager '${evidence.packageManagerField ?? ''}' (using ${pm})`)
		} else {
			// A switch cleans up before installing; a conflicting pin makes
			// pnpm/Nub refuse after that cleanup, leaving a bare checkout.
			const version: string | null = tryCapture(cliPm, ['--version'])
			const replacement: string = version === null ? `${cliPm}@<version>` : `${cliPm}@${version}`
			const pin: string = evidence.packageManagerField ?? fieldPm
			const remediation: string = `set package.json "packageManager" to '${replacement}' (or remove the field), then re-run: ${phaseCommandWithArgs(cliPm, 'install-deps', ['--pm', cliPm])}`

			if (dryRun) {
				warn(
					`packageManager '${pin}' names ${fieldPm}, not ${cliPm} — a real run fails before cleanup until it is updated`,
				)
			} else {
				fail(`packageManager '${pin}' names ${fieldPm}, but --pm chose ${cliPm}`, remediation)
			}
		}
	}

	// Version gate before any cleanup/apply: below 12.7 pnpm rejects
	// --allow-build, so the switch would roll back after moving files aside.
	// Only a readable version can fail here; a missing pnpm still belongs to
	// the hasCommand check below, and odd output must not block.
	if (pm === 'pnpm') {
		const version: string | null = tryCapture('pnpm', ['--version'])

		const upgrade: string =
			'upgrade pnpm to 12.7+ (needed to record esbuild/workerd build approvals), or choose another manager'

		if (version !== null && pnpmTooOld(version)) {
			if (dryRun) {
				warn(`pnpm ${version} is older than 12.7 — ${upgrade}`)
			} else {
				fail(`pnpm ${version} is older than 12.7`, `${upgrade} — then re-run this script`)
			}
		}
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
 * Workspace-file decision: pnpm-workspace.yaml holds pnpm config, which aube
 * and Nub also read. Keep it unless the user is leaving all three and
 * consents to its removal (answered prompt or --force). --force never
 * deletes a config the active manager reads.
 */
export async function resolveWorkspace(inputs: WorkspaceInputs): Promise<WorkspaceAction> {
	const {evidence, pm, source, force, canPrompt, ask} = inputs

	if (!evidence.hasPnpmWorkspace) {
		return 'none'
	}

	if (pm === 'pnpm' || pm === 'aube' || pm === 'nub') {
		return 'keep'
	}

	// --force is itself consent: the plan names the file before any cleanup,
	// so a non-pnpm target can remove a leftover workspace file without first
	// re-resolving through --pm or a prompt.
	const leavingPnpm: boolean =
		force ||
		evidence.lockfiles.some((lock) => lock.pm === 'pnpm') ||
		source === 'flag' ||
		source === 'packageManager'

	if (!leavingPnpm) {
		return 'keep'
	}

	if (force) {
		return 'drop'
	}

	if (canPrompt) {
		const answer: string = await ask(
			'pnpm-workspace.yaml is pnpm config (aube and Nub read it too); delete it? (y/N)',
			{
				defaultValue: 'n',
				validate: confirmValidator('n'),
			},
		)

		return answer.toLowerCase().startsWith('y') ? 'drop' : 'keep'
	}

	warn('keeping pnpm-workspace.yaml (pass --force to remove it)')

	return 'keep'
}

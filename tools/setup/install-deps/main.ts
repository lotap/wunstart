// Checkout-scoped dependency preparation. Resolution is driven by explicit
// flags and current repository evidence; no answers are stored. The program
// is safe to rerun and never touches branch services or .env.local.

import process from 'node:process'

import {fail, step} from '../../helpers/output.ts'
import {phaseCommand} from '../../helpers/package-manager.ts'
import {confirmValidator, isDeclined} from '../../helpers/prompt.ts'
import {resumeHint, runEntry, setupPhase} from '../../helpers/run-phase.ts'
import {applyPlan} from './apply.ts'
import type {CliConfig} from './cli.ts'
import {parseCliArgs} from './cli.ts'
import type {Evidence} from './evidence.ts'
import {readEvidence} from './evidence.ts'
import type {InstallPlan} from './plan.ts'
import {buildPlan, cleanupList, derivePlanInputs, printPlan, printResult} from './plan.ts'
import type {PmResolution, WorkspaceAction} from './resolve.ts'
import {resolvePm, resolveWorkspace} from './resolve.ts'

async function main(): Promise<void> {
	const cfg: CliConfig = parseCliArgs(process.argv.slice(2))

	const {canPrompt, ask, close} = setupPhase(
		{quiet: cfg.quiet, yes: cfg.yes, noInput: cfg.noInput, dryRun: cfg.dryRun},
		{
			sigint: 'interrupted — completed steps are kept; re-run install-deps to continue',
			sigterm: 'terminated — completed steps are kept; re-run install-deps to continue',
		},
	)

	try {
		step('reading checkout evidence…')
		const evidence: Evidence = readEvidence()

		const pmResolution: PmResolution = await resolvePm({
			cliPm: cfg.pm,
			evidence,
			canPrompt,
			dryRun: cfg.dryRun,
			ask,
		})

		const workspace: WorkspaceAction = await resolveWorkspace({
			evidence,
			pm: pmResolution.pm,
			source: pmResolution.source,
			force: cfg.force,
			canPrompt,
			ask,
		})

		const plan: InstallPlan = buildPlan(
			derivePlanInputs({
				pm: pmResolution.pm,
				source: pmResolution.source,
				evidence,
				workspace,
			}),
		)

		printPlan(plan, {dryRun: cfg.dryRun, canPrompt})

		if (cfg.dryRun) {
			return
		}

		// Switch cleanup deletes files, so it needs explicit consent: an
		// explicit --pm flag, a packageManager field driving the switch, an
		// answered prompt (the confirm gate below), or --force. Stale
		// lockfile regeneration is rename repair, not a switch, and stays
		// automatic; --force never resolves ambiguity, only consents.
		const switchCleanup: Array<string> = cleanupList(plan)

		const consented: boolean =
			cfg.force ||
			pmResolution.source === 'flag' ||
			pmResolution.source === 'packageManager' ||
			canPrompt

		if (switchCleanup.length > 0 && !consented) {
			const foreign: string =
				plan.foreignNodeModules === null
					? ''
					: ` (node_modules is a ${plan.foreignNodeModules.pm} tree: ${plan.foreignNodeModules.marker})`

			fail(
				`refusing to remove ${switchCleanup.join(', ')}${foreign} without consent`,
				`re-run with --pm ${plan.pm} or --force to consent to this cleanup`,
				1,
			)
		}

		if (canPrompt) {
			const proceed: string = await ask('apply this plan? (Y/n)', {
				defaultValue: 'y',
				validate: confirmValidator('y'),
			})

			if (isDeclined(proceed)) {
				fail(
					'install-deps aborted — no changes were made',
					`re-run when ready: ${phaseCommand(plan.pm, 'install-deps')}`,
					1,
				)
			}
		}

		applyPlan(plan)
		printResult(plan)
	} finally {
		close()
	}
}

runEntry(import.meta.url, main, resumeHint)

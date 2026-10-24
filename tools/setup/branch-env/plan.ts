// Branch-env plan assembly, dry-run output, and the proceed prompt. The
// plan prints the exact claimed values it can know before provisioning and
// the conditional paths it cannot.

import {fail, isQuietMode} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {phaseCommand} from '../../helpers/package-manager.ts'
import type {Asker} from '../../helpers/prompt.ts'
import {confirmValidator, isDeclined} from '../../helpers/prompt.ts'
import {MAILPIT_SMTP_WANT} from '../../helpers/trunk-ports.ts'
import {portOf, sameDbUrl} from './postgres.ts'
import type {OwnPostgres} from './stack.ts'

export type Plan = {
	lines: Array<string>
	mailpitUrl: string
	pm: Pm
	database: string
	agentDevPort: number
	devPort: number
	smtpPort: number
}

type PlanInputs = {
	pm: Pm
	branch: string
	dbWant: string
	agentDevPort: number
	devPort: number
	planDbPort: string
	mailpitUrlOverride: string
	httpPortWant: number
	smtpFree: number
	pgFree: number | null
	ownPostgres: OwnPostgres | null
	devPin?: number
	pgPin?: number
	httpPin?: number
}

/** Own-postgres wording by observed state; the plan never invents a port. */
function ownPostgresLine(own: OwnPostgres): string {
	if (own.state === 'running' && own.port !== '') {
		return `reuse our own container on :${own.port} (shared postgres is not used)`
	}

	if (own.state === 'running') {
		return 'our own container is running without a published port (fix compose.yaml; it cannot be reused)'
	}

	if (own.state === 'paused') {
		return 'our own paused container (unpause; shared postgres is not used)'
	}

	return `our own container (state: ${own.state}; start it on this branch's free port; data intact)`
}

export function buildPlan(inputs: PlanInputs): Plan {
	const {
		pm,
		branch,
		dbWant,
		agentDevPort,
		devPort,
		planDbPort,
		mailpitUrlOverride,
		httpPortWant,
		smtpFree,
		pgFree,
		ownPostgres,
		devPin,
		pgPin,
		httpPin,
	} = inputs

	const mailpitUrl: string =
		mailpitUrlOverride === '' ? `http://localhost:${httpPortWant}` : mailpitUrlOverride

	const pgOwn: string =
		pgFree === null
			? 'own container (no free port found — stop an unused stack; git worktree list finds the owner)'
			: `own container on :${pgFree}${pgPin !== undefined ? ' (pinned by --postgres-port)' : ''}`

	const postgresLine: string =
		ownPostgres !== null
			? ownPostgresLine(ownPostgres)
			: `shared :${planDbPort} if these credentials work, ${pgOwn} if unreachable, else stop with a fix-it hint`

	const lines: Array<string> = [
		`  package manager: ${pm}`,
		`  branch:          ${branch} -> database '${dbWant}'`,
		`  human server:    http://localhost:${devPort}${devPin !== undefined ? ' (pinned by --dev-port)' : ''}`,
		`  shared agent:    http://localhost:${agentDevPort} (idle-expires)`,
		`  postgres:        ${postgresLine}`,
		`  mailpit UI:      ${mailpitUrl}${httpPin !== undefined ? ' (pinned by --mailpit-port)' : ''}`,
		`  mailpit SMTP:    :${smtpFree}`,
		`  files:           .env.local`,
		'then:            containers up, db:migrate, validate-setup gate',
	]

	return {lines, mailpitUrl, pm, database: dbWant, agentDevPort, devPort, smtpPort: smtpFree}
}

type ConfirmInputs = {
	plan: Plan
	dryRun: boolean
	canPrompt: boolean
	ask: Asker['ask']
}

/**
 * Print the plan; dry-run exits before anything is created or rewritten.
 * Returns true when main should return.
 */
export async function printPlanAndConfirm(inputs: ConfirmInputs): Promise<boolean> {
	const {plan, dryRun, canPrompt, ask} = inputs

	if (dryRun) {
		// A dry-run plan is the command's primary output (stdout, pipeable),
		// not chatter: --quiet suppresses progress, never the plan itself.
		console.log(
			`plan (nothing changed):\n${plan.lines.join('\n')}\n  docker:          read-only probes only (nothing started or rewritten)`,
		)

		return true
	}

	// Non-dry-run plans go to stderr: stdout stays clean for piping,
	// whether or not the user is confirming interactively.
	if (!isQuietMode() || canPrompt) {
		console.error(`plan:\n${plan.lines.join('\n')}`)
	}

	if (canPrompt) {
		const proceed: string = await ask('proceed with this plan? (Y/n)', {
			defaultValue: 'y',
			validate: confirmValidator('y'),
		})

		if (isDeclined(proceed)) {
			fail(
				'branch-env aborted — no changes were made',
				`re-run when ready: ${phaseCommand(plan.pm, 'branch-env')}`,
				1,
			)
		}
	}

	return false
}

type PrintExtras = {
	startOwnPostgres: boolean
	postgresPort: string
	reusedPostgresPort: string
	effectiveUrl: string
	committedPort: string
	committedUrl: string
	smtpShifted: boolean
}

/** Port shown in the final summary, from whichever arm produced the URL. */
function summaryPort(extras: PrintExtras): number {
	if (extras.startOwnPostgres) {
		return Number(extras.postgresPort)
	}

	if (extras.reusedPostgresPort !== '') {
		return Number(extras.reusedPostgresPort)
	}

	return Number(portOf(extras.effectiveUrl, extras.committedPort))
}

/** Final summary (the validate-setup gate already passed). */
export function printResult(plan: Plan, extras: PrintExtras): void {
	if (isQuietMode()) {
		return
	}

	const devCmd: string = phaseCommand(plan.pm, 'dev')
	const agentDevCmd: string = phaseCommand(plan.pm, 'agent-dev')
	const devUrl: string = `http://localhost:${plan.devPort}`
	const agentDevUrl: string = `http://localhost:${plan.agentDevPort}`
	const devNote: string = plan.pm === 'bun' ? ' — never prefix dev with --bun' : ''

	const dbNote: string = sameDbUrl(extras.effectiveUrl, extras.committedUrl)
		? ' (committed .env.development)'
		: ' (DATABASE_URL in .env.local)'

	const smtpLine: string = extras.smtpShifted
		? `\n  mailpit SMTP     :${plan.smtpPort} (default :${MAILPIT_SMTP_WANT} was taken)`
		: ''

	console.log(
		`\nbranch-env complete — next:\n  ${devCmd}      (${devUrl}${devNote})\n  ${agentDevCmd} start   (reuses a human server in this worktree, else shared ${agentDevUrl})\n  mailpit UI       ${plan.mailpitUrl} (passcodes land here)\n  postgres         ${plan.database} on :${summaryPort(extras)}${dbNote}${smtpLine}`,
	)
}

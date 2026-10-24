// Branch-only development-environment provisioning. The program verifies
// the other phases' observable output, claims ports before provisioning,
// writes .env.local, provisions Postgres + Mailpit, migrates, and ends with
// the standalone validate-setup gate. Route generation is the dev/build
// server's job (its TanStack Start plugin owns routeTree.gen.ts).

import {basename, join} from 'node:path'
import process from 'node:process'

import {AGENT_DEV_PORT_MAX, AGENT_DEV_PORT_MIN, parsePort} from '../../helpers/dev-ports.ts'
import {fail, ok, step, warn} from '../../helpers/output.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {phaseCommand} from '../../helpers/package-manager.ts'
import {ROOT} from '../../helpers/paths.ts'
import {envReadFailure, validateEnvVars} from '../../helpers/required-env.ts'
import type {EffectiveEnv} from '../../helpers/required-env.ts'
import {resumeHint, runEntry, setupPhase} from '../../helpers/run-phase.ts'
import {MAILPIT_HTTP_WANT, MAILPIT_SMTP_WANT} from '../../helpers/trunk-ports.ts'
import type {CliConfig} from './cli.ts'
import {parseCliArgs} from './cli.ts'
import {persistLocal} from './local-env.ts'
import type {Plan} from './plan.ts'
import {buildPlan, printPlanAndConfirm, printResult} from './plan.ts'
import {claimIdentity, inspectWorktrees, scanAgentPort, scanClaimedPorts} from './ports.ts'
import {portOf, sameDbUrl} from './postgres.ts'
import {
	checkDependencies,
	checkDocker,
	checkIdentity,
	checkProjectFiles,
	requireUnambiguousPm,
} from './prereqs.ts'
import {
	GATE_TIMEOUT_MS,
	MIGRATE_TIMEOUT_MS,
	refreshChildEnv,
	reuseMailpitPorts,
	run,
	runScript,
	tryCapture,
} from './process.ts'
import {probeSharedPostgres, readOwnPostgres, reuseOwnPostgres, startStack} from './stack.ts'

async function main(): Promise<void> {
	const cfg: CliConfig = parseCliArgs(process.argv.slice(2))

	const {canPrompt, ask, close} = setupPhase(
		{quiet: cfg.quiet, yes: cfg.yes, noInput: cfg.noInput, dryRun: cfg.dryRun},
		{
			sigint: 'interrupted — completed steps are kept; re-run branch-env to continue',
			sigterm: 'terminated — completed steps are kept; re-run branch-env to continue',
		},
	)

	try {
		step('checking prerequisites…')
		checkIdentity()
		checkProjectFiles()
		const pm: Pm = requireUnambiguousPm()
		checkDependencies(pm)

		if (!cfg.dryRun) {
			checkDocker()
		}

		// Nothing before this point writes env files; reuse these vars for
		// the plan, the preflight, and validation instead of re-reading.
		let initialEnv: EffectiveEnv

		try {
			initialEnv = refreshChildEnv()
		} catch {
			const failure = envReadFailure(join(ROOT, '.env.development'), join(ROOT, '.env.local'))
			fail(`${failure.culprit} is missing or unreadable`, failure.hint)
		}

		const initialVars: Map<string, string> = initialEnv.vars
		const committedVars: Map<string, string> = initialEnv.devVars

		// Validated on dry runs too: this reads files and writes nothing,
		// so a dry-run plan never describes a provisioning that validation
		// would refuse. An empty devVars means the committed file is
		// missing or holds no assignments — either way there is nothing
		// to validate against, and the message below covers both.
		if (initialEnv.devVars.size === 0) {
			fail('.env.development is missing or empty', 'restore it: git checkout -- .env.development')
		}

		const envIssues = validateEnvVars(initialVars)

		if (envIssues.length > 0) {
			for (const issue of envIssues) {
				console.error(`env (.env.local over .env.development): ${issue.key} ${issue.problem}`)
			}

			fail(
				'env is invalid',
				'fix .env.local (override) or .env.development (committed) — see the issues above',
			)
		}

		const gitBranch: string | null = tryCapture('git', ['branch', '--show-current'])
		const branch: string = gitBranch === null || gitBranch === '' ? basename(ROOT) : gitBranch
		const {canonical, sibling} = inspectWorktrees(branch, ROOT)

		if (canonical.length > 1) {
			warn(
				`multiple canonical branches claim the same database and ports (${canonical.join(', ')}) — keep one canonical branch`,
			)
		}

		const {agentDevPortWant, dbWant, pgPortWant} = claimIdentity(branch)

		if (gitBranch !== null && gitBranch !== '' && sibling !== null) {
			warn(
				`another checkout at '${sibling}' is on branch '${branch}' — both claim database '${dbWant}' and the same ports (migrations would collide); work in one checkout per branch`,
			)
		}

		const committedUrl: string = committedVars.get('DATABASE_URL') ?? ''
		const committedPort: string = portOf(committedUrl)

		const planDbPort: string = portOf(
			initialVars.get('DATABASE_URL') ?? committedUrl,
			committedPort,
		)

		// Port scans happen here; binds happen after the plan/confirmation.
		// No scan is reused from an earlier command or a previous run, and a
		// port taken in between fails loudly on bind.
		step('claiming ports…')
		const {ownSmtpPort, ownHttpPort} = reuseMailpitPorts()

		const {
			agentDevPort: claimedAgentDevPort,
			agentKept,
			devPort,
			smtpFree,
			httpFree,
			pgFree,
		} = await scanClaimedPorts({
			agentDevPortWant,
			dbUrlWant: initialVars.get('DATABASE_URL') ?? '',
			dbWant,
			pgPortWant,
			ownAgentDevPort: parsePort(initialVars.get('AGENT_DEV_PORT')),
			ownSmtpPort,
			ownHttpPort,
			devPin: cfg.devPort,
			pgPin: cfg.postgresPort,
			httpPin: cfg.mailpitPort,
		})

		let agentDevPort: number = claimedAgentDevPort
		let mailpitUrlOverride = ''

		if (httpFree !== MAILPIT_HTTP_WANT) {
			mailpitUrlOverride = `http://localhost:${httpFree}`

			if (ownHttpPort === '' && !cfg.dryRun) {
				ok(`mailpit UI shifted to :${httpFree}`)
			}
		}

		const mailpitSmtpPort: string = String(smtpFree)
		const mailpitHttpPort: string = String(httpFree)
		const ownPostgres = readOwnPostgres()

		const plan: Plan = buildPlan({
			pm,
			branch,
			dbWant,
			agentDevPort,
			devPort,
			planDbPort,
			mailpitUrlOverride,
			httpPortWant: MAILPIT_HTTP_WANT,
			smtpFree,
			pgFree,
			ownPostgres,
			devPin: cfg.devPort,
			pgPin: cfg.postgresPort,
			httpPin: cfg.mailpitPort,
		})

		if (await printPlanAndConfirm({plan, dryRun: cfg.dryRun, canPrompt, ask})) {
			return
		}

		// Per-branch database preflight. Reuse our own container first;
		// otherwise use the shared one when credentials work, or start our
		// own stack on a free port.
		// SAFETY: validateEnvVars above fails the run when DATABASE_URL is
		// missing or empty, so the get cannot miss while that check stands.
		const preflightUrl: string = initialVars.get('DATABASE_URL') as string
		let effectiveUrl: string = preflightUrl
		let postgresPort = ''
		let startOwnPostgres = false
		let reusedPostgresPort = ''
		const managedOverrides = new Map<string, string>()

		step('checking postgres…')

		const reused = await reuseOwnPostgres({
			own: ownPostgres,
			preflightUrl,
			dbWant,
			revivePort: pgFree === null ? '' : String(pgFree),
			pm,
		})

		if (reused !== null) {
			effectiveUrl = reused.url
			reusedPostgresPort = reused.port
		} else {
			const probePort: string = portOf(preflightUrl, committedPort)

			const shared = await probeSharedPostgres({
				preflightUrl,
				dbWant,
				probePort,
				pgFree,
				pm,
			})

			effectiveUrl = shared.effectiveUrl
			postgresPort = shared.postgresPort
			startOwnPostgres = shared.startOwnPostgres
		}

		if (!sameDbUrl(effectiveUrl, committedUrl)) {
			managedOverrides.set('DATABASE_URL', effectiveUrl)
		}

		managedOverrides.set('DEV_PORT', String(devPort))
		managedOverrides.set('AGENT_DEV_PORT', String(agentDevPort))

		if (mailpitUrlOverride !== '') {
			managedOverrides.set('MAILPIT_URL', mailpitUrlOverride)
		}

		persistLocal(managedOverrides)

		effectiveUrl = await startStack({
			startOwnPostgres,
			postgresPort,
			mailpitSmtpPort,
			mailpitHttpPort,
			effectiveUrl,
			dbWant,
			managedOverrides,
			pm,
		})

		if (agentKept && !sameDbUrl(effectiveUrl, preflightUrl)) {
			const revalidated = await scanAgentPort({
				agentDevPortWant,
				dbUrlWant: effectiveUrl,
				dbWant,
				ownAgentDevPort: parsePort(initialVars.get('AGENT_DEV_PORT')),
			})

			if (revalidated.port === null) {
				fail(
					'no free agent dev port found after the postgres connection changed',
					`free a port in :${AGENT_DEV_PORT_MIN}-:${AGENT_DEV_PORT_MAX} (sh tools/pkg-scripts/agent-dev.sh status shows owners; stop-all is human cleanup) or stop another worktree's agent servers, then re-run`,
				)
			}

			if (revalidated.port !== agentDevPort) {
				warn(
					`postgres connection changed — the agent server on :${agentDevPort} belongs to the old database; switching to :${revalidated.port} (ask a human to run: sh tools/pkg-scripts/agent-dev.sh stop-all)`,
				)
				agentDevPort = revalidated.port
				plan.agentDevPort = agentDevPort
				managedOverrides.set('AGENT_DEV_PORT', String(agentDevPort))
				persistLocal(managedOverrides)
			}
		}

		step('applying migrations…')

		if (runScript(pm, 'db:migrate', MIGRATE_TIMEOUT_MS) !== 0) {
			fail(
				'db:migrate failed',
				`see the output above — is postgres reachable? then re-run: ${phaseCommand(pm, 'branch-env')}`,
			)
		}

		ok('migrations applied')

		// Final gate: green only if validate-setup is. It stays available
		// standalone for agents and for humans when stuck.
		step('running final validation…')
		const gate: string = join(ROOT, 'tools', 'pkg-scripts', 'validate-setup.ts')

		if (run(process.execPath, [gate], undefined, GATE_TIMEOUT_MS) !== 0) {
			fail(
				'branch-env finished but validate-setup is not green',
				`fix the issues above, then re-run: ${phaseCommand(pm, 'branch-env')}`,
			)
		}

		printResult(plan, {
			startOwnPostgres,
			postgresPort,
			reusedPostgresPort,
			effectiveUrl,
			committedPort,
			committedUrl,
			smtpShifted: mailpitSmtpPort !== String(MAILPIT_SMTP_WANT),
		})
	} finally {
		close()
	}
}

runEntry(import.meta.url, main, resumeHint)

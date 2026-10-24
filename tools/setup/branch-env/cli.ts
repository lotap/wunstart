// Command line for branch-env: flag table, parsing, and validation.

import {parseCli, rejectPositionals} from '../../helpers/cli.ts'
import {
	AGENT_DEV_PORT_MAX,
	AGENT_DEV_PORT_MIN,
	inAgentDevRange,
	parsePort,
} from '../../helpers/dev-ports.ts'
import {fail} from '../../helpers/output.ts'
import {detectPm, phaseCommand, phaseExample} from '../../helpers/package-manager.ts'

const CLI_OPTIONS = {
	'dev-port': {type: 'string'},
	'postgres-port': {type: 'string'},
	'mailpit-port': {type: 'string'},
	'yes': {type: 'boolean', short: 'y'},
	'no-input': {type: 'boolean'},
	'quiet': {type: 'boolean', short: 'q'},
	'dry-run': {type: 'boolean', short: 'n'},
} as const

/** Parsed and validated flags. */
export type CliConfig = {
	devPort: number | undefined
	postgresPort: number | undefined
	mailpitPort: number | undefined
	yes: boolean
	noInput: boolean
	quiet: boolean
	dryRun: boolean
}

function usage(): void {
	const pm = detectPm()
	const appIdentity: string = phaseCommand(pm, 'app-identity')
	const installDeps: string = phaseCommand(pm, 'install-deps')
	console.log(`usage: branch-env [--dev-port <port>] [--postgres-port <port>] [--mailpit-port <port>] [--dry-run] [--yes] [--no-input] [--quiet] [--help]

  Branch-only development-environment provisioning. Verifies the
  app-identity and install-deps prerequisites, claims this branch's ports
  before provisioning, writes .env.local, reuses or starts Postgres and
  Mailpit, ensures the branch database, applies migrations, and ends with
  the validate-setup gate. Route generation belongs to the dev/build
  server (its TanStack Start plugin regenerates routeTree.gen.ts).

  Every worktree writes DEV_PORT=3000 (the human server) and claims
  AGENT_DEV_PORT from :${AGENT_DEV_PORT_MIN}-:${AGENT_DEV_PORT_MAX} for agents.

  examples:
    ${phaseExample(pm, 'branch-env')}                   provision this checkout, then serve :3000
    ${phaseExample(pm, 'branch-env', ['--dry-run'])}         show the plan without changing anything
    ${phaseExample(pm, 'branch-env', ['--yes'])}             never prompt (CI and agents)
    ${phaseExample(pm, 'branch-env', ['--dev-port', '3200'])}   pin the human server to :3200 (rare; fails when taken)

  --dev-port <port>       pin the human server to this port outside :${AGENT_DEV_PORT_MIN}-:${AGENT_DEV_PORT_MAX}
                          (fails when taken; rare override for two human worktrees)
  --postgres-port <port>  pin our own postgres to this port (fails when taken)
  --mailpit-port <port>   pin the mailpit UI to this port (fails when taken; SMTP is auto-selected)
  --dry-run, -n           print the plan and exit before changing anything
  --yes, -y               accept all defaults without prompting (required when non-interactive)
  --quiet, -q             silence progress, plans, summaries, and child output on success (warnings, failures, and dry-run/confirmation plans still print)
  --no-input              disable prompts; fails unless --yes or --dry-run is also passed
  -h, --help              this text

  Prerequisites are observable state, never automatic repairs:
  - missing or invalid identity -> run: ${appIdentity}
  - missing or stale dependencies -> run: ${installDeps}
  This program never renames, installs packages, or hand-edits committed
  project files. It writes .env.local and may create branch databases/containers.
  Port scans happen here, before provisioning.

  exit codes: 0 done, 1 operational failure, 2 bad usage, 130 interrupted,
  143 terminated.`)
}

/** A pinned port: an integer 1-65535, or a usage error mirroring vite's DEV_PORT check. */
function parsePortFlag(raw: string | undefined, flag: string): number | undefined {
	if (raw === undefined) {
		return undefined
	}

	const port: number | null = parsePort(raw)

	if (port === null) {
		fail(`invalid ${flag} ${JSON.stringify(raw)}`, `pass ${flag} <1-65535>`, 2)
	}

	return port
}

/** Parse argv into validated config; --help wins over everything. */
export function parseCliArgs(argv: Array<string>): CliConfig {
	const {values, positionals} = parseCli(argv, CLI_OPTIONS, usage)
	rejectPositionals(positionals, 'this program takes flags only (see --help)')

	const devPort: number | undefined = parsePortFlag(values['dev-port'], '--dev-port')

	// The agent range is the safety boundary: no human port inside it, so
	// agent cleanup can never touch a human server.
	if (devPort !== undefined && inAgentDevRange(devPort)) {
		fail(
			`--dev-port :${devPort} is inside the agent-only range :${AGENT_DEV_PORT_MIN}-:${AGENT_DEV_PORT_MAX}`,
			`pin the human server outside :${AGENT_DEV_PORT_MIN}-:${AGENT_DEV_PORT_MAX} (every worktree defaults to :3000)`,
			2,
		)
	}

	return {
		devPort,
		postgresPort: parsePortFlag(values['postgres-port'], '--postgres-port'),
		mailpitPort: parsePortFlag(values['mailpit-port'], '--mailpit-port'),
		yes: values.yes ?? false,
		noInput: values['no-input'] ?? false,
		quiet: values.quiet ?? false,
		dryRun: values['dry-run'] ?? false,
	}
}

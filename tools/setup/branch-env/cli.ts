// Command line for branch-env: flag table, parsing, and validation.

import {parseCli, rejectPositionals} from '../../helpers/cli.ts'
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

  examples:
    ${phaseExample(pm, 'branch-env')}                   provision this checkout, then serve its port
    ${phaseExample(pm, 'branch-env', ['--dry-run'])}         show the plan without changing anything
    ${phaseExample(pm, 'branch-env', ['--yes'])}             never prompt (CI and agents)
    ${phaseExample(pm, 'branch-env', ['--dev-port', '3199'])}   pin the dev server to :3199 (fails when taken)

  --dev-port <port>       pin the dev server to this port (fails when taken)
  --postgres-port <port>  pin our own postgres to this port (fails when taken)
  --mailpit-port <port>   pin the mailpit UI to this port (fails when taken)
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
	const port: number = Number(raw)
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		fail(`invalid ${flag} ${JSON.stringify(raw)}`, `pass ${flag} <1-65535>`, 2)
	}
	return port
}

/** Parse argv into validated config; --help wins over everything. */
export function parseCliArgs(argv: Array<string>): CliConfig {
	const {values, positionals} = parseCli(argv, CLI_OPTIONS, usage)
	rejectPositionals(positionals, 'this program takes flags only (see --help)')
	return {
		devPort: parsePortFlag(values['dev-port'], '--dev-port'),
		postgresPort: parsePortFlag(values['postgres-port'], '--postgres-port'),
		mailpitPort: parsePortFlag(values['mailpit-port'], '--mailpit-port'),
		yes: values.yes ?? false,
		noInput: values['no-input'] ?? false,
		quiet: values.quiet ?? false,
		dryRun: values['dry-run'] ?? false,
	}
}

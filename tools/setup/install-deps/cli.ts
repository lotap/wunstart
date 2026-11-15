// Command line for install-deps: flag table, parsing, and validation.

import {parseCli, parseEnum, rejectPositionals} from '../../helpers/cli.ts'
import type {Pm} from '../../helpers/package-manager.ts'
import {detectPm, phaseExample, PM_TOOLS} from '../../helpers/package-manager.ts'

const CLI_OPTIONS = {
	'pm': {type: 'string'},
	'force': {type: 'boolean', short: 'f'},
	'yes': {type: 'boolean', short: 'y'},
	'no-input': {type: 'boolean'},
	'quiet': {type: 'boolean', short: 'q'},
	'dry-run': {type: 'boolean', short: 'n'},
} as const

/** Parsed and validated flags. */
export type CliConfig = {
	pm: Pm | undefined
	force: boolean
	yes: boolean
	noInput: boolean
	quiet: boolean
	dryRun: boolean
}

function usage(): void {
	const pm = detectPm()
	const pmChoices: string = PM_TOOLS.join('|')
	console.log(`usage: install-deps [--pm ${pmChoices}] [--force] [--dry-run] [--yes] [--no-input] [--quiet] [--help]

  Checkout-scoped dependency preparation. Resolves the package manager from
  explicit flags and repository evidence, moves artifacts that belong to a
  different manager aside (restoring them if install fails), installs
  dependencies, and sets up git hooks. Safe to rerun. Route generation
  belongs to the dev/build server (its TanStack Start plugin regenerates
  routeTree.gen.ts, type registration included), never to this program.

  examples:
    ${phaseExample(pm, 'install-deps')}            resolve from lockfiles, install if needed
    ${phaseExample(pm, 'install-deps', ['--pm', 'pnpm'])}  use pnpm (removes other managers' artifacts)
    ${phaseExample(pm, 'install-deps', ['--dry-run'])}  show the plan, change nothing
    ${phaseExample(pm, 'install-deps', ['--yes'])}      never prompt (CI and agents)

  --pm            switch this checkout to the given package manager (${pmChoices}); removes other managers' lockfiles and incompatible node_modules
  --force, -f     permit destructive cleanup without prompting (removes superseded lockfiles and node_modules; removes a leftover pnpm-workspace.yaml when pnpm, aube, and Nub are not the target)
  --dry-run, -n   print the plan and exit before changing anything
  --yes, -y       accept all defaults without prompting (non-TTY implies this)
  --quiet, -q     silence progress, plans, summaries, and child output on success (warnings, failures, and dry-run/confirmation plans still print)
  --no-input      disable prompts; fails unless --yes or --dry-run is also passed
  -h, --help      this text

  Resolution order: --pm, exactly one lockfile, package.json "packageManager"
  (when no lockfile exists), then the fresh-tree default (bun when
  installed, otherwise the only installed manager). Multiple lockfiles, or
  node_modules without lockfile or packageManager evidence, are ambiguous.
  pnpm-workspace.yaml is package-manager config, not manager evidence. Interactive
  runs prompt, non-interactive runs fail with the exact command to run. No
  persistent answers are stored.

  This program never claims ports, writes .env.local, starts services,
  creates branch databases, or runs migrations. Run branch-env next.

  exit codes: 0 done, 1 operational failure, 2 bad usage, 130 interrupted, 143 terminated.`)
}

/** Parse argv into validated config; --help wins over everything. */
export function parseCliArgs(argv: Array<string>): CliConfig {
	const {values, positionals} = parseCli(argv, CLI_OPTIONS, usage)
	rejectPositionals(positionals, 'this program takes flags only (see --help)')

	return {
		pm:
			values.pm !== undefined
				? parseEnum(
						values.pm.toLowerCase(),
						PM_TOOLS,
						'package manager',
						`use --pm ${PM_TOOLS.join(', ')}`,
					)
				: undefined,
		force: values.force ?? false,
		yes: values.yes ?? false,
		noInput: values['no-input'] ?? false,
		quiet: values.quiet ?? false,
		dryRun: values['dry-run'] ?? false,
	}
}

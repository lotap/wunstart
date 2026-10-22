// Command line for app-identity: flag table, parsing, and validation.

import {isValidSlug} from '../../helpers/app-name.ts'
import {parseCli} from '../../helpers/cli.ts'
import {fail} from '../../helpers/output.ts'
import {detectPm, phaseExample} from '../../helpers/package-manager.ts'

const CLI_OPTIONS = {
	'name': {type: 'string'},
	'description': {type: 'string'},
	'skip-rename': {type: 'boolean'},
	'yes': {type: 'boolean', short: 'y'},
	'no-input': {type: 'boolean'},
	'quiet': {type: 'boolean', short: 'q'},
	'dry-run': {type: 'boolean', short: 'n'},
} as const

/** Parsed and validated flags. */
export type CliConfig = {
	name: string | undefined
	description: string | null
	skipRename: boolean
	yes: boolean
	noInput: boolean
	quiet: boolean
	dryRun: boolean
}

function usage(): void {
	const pm = detectPm()
	console.log(`usage: app-identity [--name slug] [--description text] [--dry-run] [--yes] [--quiet] [--skip-rename] [--help] [name]

  Resolve the application name and description, validate the committed
  project shape, and synchronize package.json, wrangler.jsonc,
   src/app-info.ts (name and description only), public/llms.txt, and
   CONTEXT.md (title only).
  Stateless: every run derives its target from flags and the files
  themselves. Run install-deps after a rename to regenerate the active
  lockfile.

  examples:
    ${phaseExample(pm, 'app-identity', ['my-app'])}      rename and sync the identity
    ${phaseExample(pm, 'app-identity', ['--dry-run'])}   show the identity plan, change nothing
    ${phaseExample(pm, 'app-identity', ['--yes'])}       use the current identity, zero prompts

  --name          app name (same as the positional arg)
  --description   one-line app description ("" clears)
  --skip-rename   keep the current package name, ignoring --name (still syncs other files)
  --dry-run, -n   print the plan and exit before changing anything
  --yes, -y       accept all defaults without prompting (non-TTY implies this)
  --quiet, -q     silence progress, plans, summaries, and child output on success (warnings, failures, and dry-run/confirmation plans still print)
  --no-input      disable prompts; fails unless --yes or --dry-run is also passed
  -h, --help      this text

  Prompts only fire on a TTY for undecided questions (never under --dry-run).
  This program uses node builtins only and runs before dependencies are
  installed. It validates the committed .env.development shape and the
  committed wasm kernel, but never writes .env.local, scans ports, touches
  Docker, or installs packages.

  exit codes: 0 done, 1 operational failure, 2 bad usage, 130 interrupted, 143 terminated.`)
}

/**
 * One-line description guard: the value lands on a single-line llms.txt
 * line and inside a quoted TS string, so a line break would produce an
 * unprefixed second line.
 */
export function checkDescription(
	raw: string,
	source: string,
	code: 1 | 2 = 2,
	hint = 'use a single line with no line breaks',
): string {
	const value: string = raw.trim()

	if (/[\n\r\v\f\u2028\u2029]/.test(value)) {
		fail(`bad app description in ${source} (one line only)`, hint, code)
	}

	return value
}

/** Parse argv into validated config; --help wins over everything. */
export function parseCliArgs(argv: Array<string>): CliConfig {
	const {values, positionals} = parseCli(argv, CLI_OPTIONS, usage)

	if (positionals.length > 1) {
		fail(`unexpected argument: ${positionals[1]}`, 'pass at most one app name', 2)
	}

	const positionalName: string | undefined = positionals[0]
	const flagName: string | undefined = values.name

	if (positionalName !== undefined && flagName !== undefined) {
		fail('app name given twice', 'pass it once: `app-identity my-app` or `--name my-app`', 2)
	}

	const name: string | undefined = positionalName ?? flagName

	// Empty is never a keep-the-current spelling (unlike --description "",
	// which clears): it is almost always a quoting accident (`--name ""`),
	// and silently keeping would hide it. Omit --name to keep.
	if (name !== undefined && name === '') {
		fail('app name is empty', 'omit --name to keep the current name, or pass a valid slug', 2)
	}

	if (name !== undefined) {
		const problem: string | null = isValidSlug(name)

		if (problem !== null) {
			fail(`bad app name '${name}'`, problem, 2)
		}
	}

	return {
		name,
		description:
			// Triple-state: flag absent keeps the current value (null), ""
			// clears it, anything else sets it (trimmed by checkDescription).
			values.description !== undefined
				? checkDescription(values.description, '--description')
				: null,
		skipRename: values['skip-rename'] ?? false,
		yes: values.yes ?? false,
		noInput: values['no-input'] ?? false,
		quiet: values.quiet ?? false,
		dryRun: values['dry-run'] ?? false,
	}
}

import {dirname, join} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

import {parseCli} from '../helpers/cli.ts'
import {fail} from '../helpers/output.ts'
import type {EnvValidation} from '../helpers/required-env.ts'
import {envReadFailure, validateRequiredEnv} from '../helpers/required-env.ts'
import {resumeHint, runEntry} from '../helpers/run-phase.ts'

// Entry point for `bun run validate-required-env`. All logic lives in
// tools/helpers/required-env.ts; this file only parses argv and reports.

function usage(): void {
	console.log(`usage: validate-required-env [.env.development] [--help]

  Checks that every required env key is present and well-shaped
  (committed file overlaid by .env.local). Run from anywhere inside the
  worktree (paths anchor at the repo root). Exit code 1 on any issue.`)
}

function main(): void {
	const parsed = parseCli(process.argv.slice(2), {}, usage)
	if (parsed.positionals.length > 1) {
		fail(`unexpected argument: ${parsed.positionals[1]}`, 'pass at most one env file', 2)
	}
	// Anchor at the repo root like validate-setup: a bare relative path
	// resolves the same from any subdirectory.
	try {
		process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..', '..'))
	} catch {
		console.error('FAIL could not anchor at the repo root')
		console.error('hint: run from inside the worktree')
		process.exitCode = 1
		return
	}
	const arg: string | undefined = parsed.positionals[0]
	const path: string = arg === undefined || arg === '' ? '.env.development' : arg
	let issues: EnvValidation['issues']
	let overlaid: boolean
	try {
		;({issues, overlaid} = validateRequiredEnv(path, '.env.local'))
	} catch {
		// Reads, not validation: an unreadable file must report like every
		// other failure, not a raw stack.
		const failure = envReadFailure(path, '.env.local')
		console.error(`FAIL ${failure.culprit} is missing or unreadable`)
		console.error(`hint: ${failure.hint}`)
		process.exitCode = 1
		return
	}
	const suffix: string = overlaid ? ' (+ .env.local)' : ''
	if (issues.length === 0) {
		console.log(`env ${path}${suffix}: ok`)
		return
	}
	for (const issue of issues) {
		console.log(`env ${path}: ${issue.key} ${issue.problem}`)
	}
	process.exitCode = 1
}

// Direct invocation runs main; an unexpected throw reports through the
// same scrubbed FAIL path as the phased programs (main itself handles
// validation failures with exit codes above).
runEntry(import.meta.url, main, resumeHint)

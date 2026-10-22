// Shared entry-point scaffolding for the setup phase programs: quiet mode,
// prompt gating, signal handling, and the top-level failure report. The
// interactive phases register the same handlers, so they live here once.
// Multiple consumers by design (AGENTS.md Placement): every interactive
// phase and both standalone checks use this module.

import {realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import process from 'node:process'
import {fileURLToPath} from 'node:url'

import {fail, setQuiet} from './output.ts'
import type {Asker} from './prompt.ts'
import {claimInterrupt, createAsker} from './prompt.ts'

/**
 * Redact `://user:password@` credentials so errors can print safely.
 * Greedy within the authority (up to the last @): a raw @ inside the
 * password must not leak the fragment after it. Query/fragment @s are
 * out of scope — the match never crosses `/`, `?`, or `#`.
 */
function scrubSecrets(text: string): string {
	return text.replace(/:\/\/[^/\s?#]*@/g, '://***@')
}

/** Flag subset every phased program parses (quiet/yes/no-input/dry-run mean the same everywhere). */
export type PhaseFlags = {quiet: boolean; yes: boolean; noInput: boolean; dryRun: boolean}

export type PhaseSession = {
	canPrompt: boolean
	ask: Asker['ask']
	close: () => void
}

/** Phase-specific interrupt lines (SIGINT vs SIGTERM differ only in the first word). */
export type InterruptMessages = {sigint: string; sigterm: string}

/**
 * Quiet mode, TTY-gated prompting, and the single SIGINT/SIGTERM owner.
 * The readline close-path in prompt.ts can fire on the same Ctrl-C, so
 * both sides claim a shared once-guard: whichever fires first prints,
 * the other exits silently.
 */
export function setupPhase(flags: PhaseFlags, messages: InterruptMessages): PhaseSession {
	setQuiet(flags.quiet)
	const canPrompt: boolean = process.stdin.isTTY && !flags.yes && !flags.noInput && !flags.dryRun

	if (!canPrompt && !flags.yes && !flags.dryRun) {
		fail(
			'cannot prompt for confirmation (stdin is not a TTY, or --no-input is set)',
			'pass --yes to accept the plan, or --dry-run to inspect it without changes',
			2,
		)
	}

	const {ask, close}: Asker = createAsker(canPrompt, messages.sigint)
	process.on('SIGINT', () => {
		close()

		if (claimInterrupt()) {
			console.error(messages.sigint)
		}

		process.exit(130)
	})
	process.on('SIGTERM', () => {
		close()

		if (claimInterrupt()) {
			console.error(messages.sigterm)
		}

		process.exit(143)
	})

	return {canPrompt, ask, close}
}

/**
 * Direct-invocation guard plus the top-level failure report: scrubbed
 * single FAIL line with the re-run hint, exit code 1. Never print a raw
 * stack — an unexpected error must report like every other failure.
 * The hint is a thunk so it can depend on state only known at throw
 * time (validate-setup's manager-sensitive hint).
 */
function sameFile(a: string, b: string): boolean {
	try {
		return realpathSync(a) === realpathSync(b)
	} catch {
		return resolve(a) === resolve(b)
	}
}

export function runEntry(
	entryUrl: string,
	main: () => Promise<void> | void,
	hint: () => string,
): void {
	// Resolved-path compare (callers pass import.meta.url): every setup
	// entry is named main.ts, so a basename check cannot distinguish an
	// imported phase from the invoked one.
	const invoked: string = process.argv[1] ?? ''

	if (invoked === '' || !sameFile(invoked, fileURLToPath(entryUrl))) {
		return
	}

	// Deferred through .then so a synchronous throw in main reports through
	// the same scrubbed path as a rejection.
	Promise.resolve()
		.then(() => main())
		.catch((error) => {
			const raw: string = error instanceof Error ? (error.stack ?? error.message) : String(error)
			console.error(`FAIL ${scrubSecrets(raw)}`)
			console.error(`hint: ${hint()}`)
			process.exitCode = 1
		})
}

/** Default re-run hint for the phased programs (unexpected-failure tail). */
export function resumeHint(): string {
	return 're-run with the same args once the issue above is fixed'
}

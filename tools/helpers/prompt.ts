/* oxlint-disable no-await-in-loop -- prompts are serial by design */
// Shared interactive prompt for the setup programs. Flags and files resolve
// first; ask() only handles the human layer.

import process from 'node:process'
import {createInterface} from 'node:readline'

type AskOptions = {
	/** Shown in brackets; Enter accepts it. No default = empty string. */
	defaultValue?: string
	/** Return an error message, or null when the answer is acceptable. */
	validate?: (answer: string) => string | null
}

export type Asker = {
	ask: (label: string, options?: AskOptions) => Promise<string>
	close: () => void
}

/**
 * Single-print guard for interrupts: the SIGINT/SIGTERM handlers in
 * run-phase.ts and the readline close-path below both fire on one Ctrl-C.
 * Whichever claims first prints; the other exits silently.
 */
let interruptClaimed = false

export function claimInterrupt(): boolean {
	if (interruptClaimed) {
		return false
	}
	interruptClaimed = true
	return true
}

/** Validation for y/n confirmations; empty takes the default. */
export function confirmValidator(emptyDefault: 'y' | 'n'): (value: string) => string | null {
	return (value: string) =>
		['y', 'n', 'yes', 'no', ''].includes(value.toLowerCase())
			? null
			: emptyDefault === 'y'
				? 'answer y or n (empty = yes)'
				: 'answer y or n (empty = no)'
}

/** True when a y/n answer declines (starts with n). */
export function isDeclined(answer: string): boolean {
	return answer.toLowerCase().startsWith('n')
}

/**
 * Non-TTY/--yes returns the default without prompting; otherwise readline
 * with a validation loop. The interrupt message is phase-specific because
 * the state left behind differs.
 */
export function createAsker(canPrompt: boolean, interruptMessage: string): Asker {
	if (!canPrompt) {
		return {
			ask: async (_label: string, options?: AskOptions) => options?.defaultValue ?? '',
			close: () => {},
		}
	}
	const rl = createInterface({
		input: process.stdin,
		output: process.stderr,
	})
	let pending: ((value: string | null) => void) | null = null
	rl.on('close', () => {
		const resolvePending = pending
		pending = null
		resolvePending?.(null)
	})
	const ask = async (label: string, options?: AskOptions): Promise<string> => {
		const suffix: string =
			options?.defaultValue !== undefined && options.defaultValue !== ''
				? ` [${options.defaultValue}]`
				: ''
		for (;;) {
			const raw: string | null = await new Promise((resolve) => {
				pending = resolve
				rl.question(`${label}${suffix}: `, (answer) => {
					pending = null
					resolve(answer)
				})
			})
			if (raw === null) {
				if (claimInterrupt()) {
					console.error(interruptMessage)
				}
				process.exit(130)
			}
			const answer: string = raw.trim() === '' ? (options?.defaultValue ?? '') : raw.trim()
			const problem: string | null = options?.validate?.(answer) ?? null
			if (problem === null) {
				return answer
			}
			console.error(`  ${problem} — try again`)
		}
	}
	return {ask, close: () => rl.close()}
}

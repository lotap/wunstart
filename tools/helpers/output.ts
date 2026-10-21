// User-facing output: ok/warn/step lines and fatal failures. Progress goes
// to stderr so stdout stays free for a program's final summary.

import process from 'node:process'

let quietMode = false

/** Set from --quiet before any output. */
export function setQuiet(quiet: boolean): void {
	quietMode = quiet
}

/** Read by long-running steps that print their own progress. */
export function isQuietMode(): boolean {
	return quietMode
}

export function ok(message: string): void {
	if (quietMode) {
		return
	}
	console.error(`ok   ${message}`)
}

export function warn(message: string): void {
	console.error(`warn ${message}`)
}

/** Progress preface: what is starting now (quiet-suppressed like ok). */
export function step(message: string): void {
	if (quietMode) {
		return
	}
	console.error(`...  ${message}`)
}

export function fail(message: string, hint: string, code: 1 | 2 = 1): never {
	console.error(`FAIL ${message}`)
	console.error(`hint: ${hint}`)
	process.exit(code)
}

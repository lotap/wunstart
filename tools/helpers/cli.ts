// Shared command-line parsing for the setup programs: help detection,
// duplicate flags, value checks, did-you-mean suggestions, and strict
// unknown-argument rejection. Program-specific help and validation stay
// with each command.

import process from 'node:process'
import {parseArgs} from 'node:util'

import {fail} from './output.ts'

export type CliOption = {type: 'string' | 'boolean'; short?: string}

export type CliOptions = Record<string, CliOption>

export type CliValues<O extends CliOptions> = {
	[K in keyof O]?: O[K]['type'] extends 'string' ? string : boolean
}

type ParsedCli<O extends CliOptions> = {
	values: CliValues<O>
	positionals: Array<string>
}

function valueFlags(options: CliOptions): ReadonlySet<string> {
	const flags = new Set<string>()

	for (const [flag, option] of Object.entries(options)) {
		if (option.type === 'string') {
			flags.add(`--${flag}`)
		}
	}

	return flags
}

function wantsHelp(argv: ReadonlyArray<string>, values: ReadonlySet<string>): boolean {
	for (let i = 0; i < argv.length; i += 1) {
		const arg: string = argv[i] ?? ''

		if (arg === '--') {
			return false
		}

		if (arg !== '-h' && arg !== '--help') {
			continue
		}

		if (i > 0 && values.has(argv[i - 1] ?? '')) {
			continue
		}

		return true
	}

	return false
}

function suggestFlag(seen: string, options: CliOptions): string | null {
	const known: Array<string> = ['--help', '-h']

	for (const [flag, option] of Object.entries(options)) {
		known.push(`--${flag}`)

		if (option.short !== undefined) {
			known.push(`-${option.short}`)
		}
	}

	const lowered: string = seen.toLowerCase()

	for (const candidate of known) {
		if (candidate.toLowerCase() === lowered) {
			return candidate
		}
	}

	if (seen.length <= 2) {
		return null
	}

	for (const candidate of known) {
		if (candidate.startsWith(seen) || seen.startsWith(candidate)) {
			return candidate
		}
	}

	// Typo tolerance: closest spelling within 2 edits (`--dru-run` ->
	// `--dry-run`). Prefix matches above win; this only fires when no
	// prefix relates the two.
	let best: string | null = null
	let bestDist = 3

	for (const candidate of known) {
		const dist: number = editDistance(lowered, candidate.toLowerCase())

		if (dist < bestDist) {
			bestDist = dist
			best = candidate
		}
	}

	return best
}

/** Edit distance over short flag spellings (typo tolerance for did-you-mean). */
function editDistance(a: string, b: string): number {
	let prev: Array<number> = Array.from({length: b.length + 1}, (_, i) => i)

	for (let i = 1; i <= a.length; i += 1) {
		const next: Array<number> = [i]

		for (let j = 1; j <= b.length; j += 1) {
			next[j] = Math.min(
				(prev[j] ?? 0) + 1,
				(next[j - 1] ?? 0) + 1,
				(prev[j - 1] ?? 0) + ((a[i - 1] ?? '') === (b[j - 1] ?? '') ? 0 : 1),
			)
		}

		prev = next
	}

	return prev[b.length] ?? 0
}

function booleanFlagFor(token: string, options: CliOptions): string | null {
	const name: string = token.replace(/^-+/, '')

	for (const [flag, option] of Object.entries(options)) {
		if (option.type !== 'boolean') {
			continue
		}

		if (flag === name || option.short === name) {
			return `--${flag}`
		}
	}

	return null
}

/**
 * Canonical long spelling for a flag token (`-n` and `--dry-run` both map
 * to `--dry-run`), or null when the token names nothing in the table.
 * Unknown tokens stay raw here: parseArgs rejects them below with a
 * did-you-mean hint.
 */
function canonicalFlagFor(token: string, options: CliOptions): string | null {
	if (token === '-h' || token === '--help') {
		return '--help'
	}

	const name: string = token.replace(/^-+/, '')

	for (const [flag, option] of Object.entries(options)) {
		if (flag === name || option.short === name) {
			return `--${flag}`
		}
	}

	return null
}

/**
 * Parse argv into typed flags and positionals. --help wins over everything;
 * duplicate flags, missing values, and unknown options fail as usage errors.
 */
export function parseCli<const O extends CliOptions>(
	argv: ReadonlyArray<string>,
	options: O,
	usage: () => void,
): ParsedCli<O> {
	const stringFlags: ReadonlySet<string> = valueFlags(options)

	if (wantsHelp(argv, stringFlags)) {
		usage()
		process.exit(0)
	}

	const seenFlags = new Set<string>()

	for (let i = 0; i < argv.length; i += 1) {
		const arg: string = argv[i] ?? ''

		if (arg === '--') {
			break
		}

		if (i > 0 && stringFlags.has(argv[i - 1] ?? '')) {
			continue
		}

		if (!arg.startsWith('-') || arg === '-') {
			continue
		}

		const name: string = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg
		// Compare canonical spellings: `-n --dry-run` is the same flag twice.
		const canonical: string = canonicalFlagFor(name, options) ?? name

		if (seenFlags.has(canonical)) {
			fail(`option '${canonical}' passed more than once`, 'pass it once', 2)
		}

		seenFlags.add(canonical)
	}

	let parsed

	try {
		parsed = parseArgs({args: [...argv], strict: true, allowPositionals: true, options})
	} catch (error) {
		const detail: string = error instanceof Error ? error.message : String(error)
		const code: string = error instanceof Error && 'code' in error ? String(error.code) : ''
		const token: string | null = detail.match(/'(-{1,2}[A-Za-z-]*)[^']*'/)?.[1] ?? null

		if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE' && token !== null) {
			const booleanFlag: string | null = booleanFlagFor(token, options)

			if (booleanFlag !== null) {
				fail(`option '${booleanFlag}' does not take a value`, 'pass it bare, without a value', 2)
			}

			fail(`option '${token}' needs a value`, `use ${token} <value> or ${token}=<value>`, 2)
		}

		const suggestion: string | null = token === null ? null : suggestFlag(token, options)
		fail(
			`unexpected argument: ${token === null ? detail : `'${token}'`}`,
			suggestion === null ? 'see --help' : `did you mean ${suggestion}? (see --help)`,
			2,
		)
	}

	// SAFETY: parseArgs mirrors the option table's value types; the option
	// table is const-typed at each call site.
	const values = parsed.values as CliValues<O>

	return {values, positionals: parsed.positionals}
}

export function rejectPositionals(positionals: Array<string>, hint: string): void {
	const extra: string | undefined = positionals[0]

	if (extra !== undefined) {
		fail(`unexpected argument: ${extra}`, hint, 2)
	}
}

export function parseEnum<T extends string>(
	value: string,
	allowed: ReadonlyArray<T>,
	subject: string,
	hint: string,
): T {
	const found: T | undefined = allowed.find((item) => item === value)

	if (found === undefined) {
		fail(`unknown ${subject}: ${value}`, hint, 2)
	}

	return found
}

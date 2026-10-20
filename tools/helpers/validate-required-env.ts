import {existsSync, readFileSync} from 'node:fs'
import {connect} from 'node:net'
import {basename} from 'node:path'
import process from 'node:process'

/**
 * Shared `.env` validation — single source of truth for env shape.
 *
 * `bun run validate-setup` and `tools/setup/*` share the loader, validator,
 * prober, and name finder below (same functions in both flows).
 * Shapes mirror the runtime
 * consumers: `DATABASE_URL` per `src/db/index.ts`, `*_SECRETS` per
 * `src/db/ops/auth/_auth-layer.ts` (`id:secret` CSV pairs).
 *
 * Dependency-free (node builtins only) so setup can use it before
 * `bun install`. Single-file helper in tools/helpers: imported by
 * tools/setup and tools/helpers/validate-setup (tools/ never imports
 * from src/).
 */

/** Scanner state threaded across lines: block comments can span lines. */
export type JsoncState = {inBlock: boolean}

/**
 * Strip `//` and `/* *\/` comments from a JSONC line, string-aware: comment
 * markers inside a quoted value (e.g. `"url": "https://…"`) are content, not
 * comments — otherwise a brace or `"name"` inside a comment skews depth
 * tracking in findTopLevelName. Length-preserving: stripped comment chars
 * become spaces, so char offsets stay aligned with the raw line (the finder
 * returns a raw-line offset that the rename and the names check apply to
 * the unstripped text).
 */
export function stripJsoncLine(line: string, state: JsoncState): string {
	let out = ''
	let inString = false
	let i = 0
	while (i < line.length) {
		const ch: string = line[i] ?? ''
		const next: string = line[i + 1] ?? ''
		if (state.inBlock) {
			if (ch === '*' && next === '/') {
				state.inBlock = false
				out += '  '
				i += 2
			} else {
				out += ' '
				i += 1
			}
		} else if (inString) {
			if (ch === '\\' && i + 1 < line.length) {
				out += line.slice(i, i + 2)
				i += 2
			} else {
				out += ch
				if (ch === '"') {
					inString = false
				}
				i += 1
			}
		} else if (ch === '"') {
			inString = true
			out += ch
			i += 1
		} else if (ch === '/' && next === '/') {
			out += ' '.repeat(line.length - i)
			break
		} else if (ch === '/' && next === '*') {
			state.inBlock = true
			out += '  '
			i += 2
		} else {
			out += ch
			i += 1
		}
	}
	return out
}

/** Net `{` minus `}` in comment-stripped code, ignoring braces in strings. */
function braceDepthDelta(code: string): number {
	let delta = 0
	let inString = false
	for (let i = 0; i < code.length; i += 1) {
		const ch: string = code[i] ?? ''
		if (inString) {
			if (ch === '\\') {
				i += 1
			} else if (ch === '"') {
				inString = false
			}
		} else if (ch === '"') {
			inString = true
		} else if (ch === '{') {
			delta += 1
		} else if (ch === '}') {
			delta -= 1
		}
	}
	return delta
}

/** Location of the top-level `"name"` in a JSONC document (0-based). */
export type TopLevelName = {line: number; at: number}

/**
 * Location of the top-level `"name": "` in a JSONC document (wrangler.jsonc).
 * Depth-tracked so nested objects (bindings, rules) never match: a match
 * qualifies when the braces preceding it bring the depth to exactly 1.
 * Every match on a line is checked, not just the first — a minified
 * single-line document can hold a nested `"name"` before the top-level one.
 * The char offset pairs the rename/extract with the same match the finder
 * qualified (first-match consumers would hit the nested one). Line and
 * block comments are stripped string-aware first, so a `{` or `"name"`
 * inside a comment cannot throw off the depth. Single shared copy:
 * tools/setup/setup.ts (rename) and validate-setup (names check) use this.
 */
export function findTopLevelName(lines: Array<string>): TopLevelName | null {
	let depth = 0
	const state: JsoncState = {inBlock: false}
	for (let i = 0; i < lines.length; i += 1) {
		const code: string = stripJsoncLine(lines[i] ?? '', state)
		// No /g + matchAll (iterator typing): rescan past each non-top-level
		// match; matches cannot overlap, so +1 always advances.
		let scanFrom = 0
		for (;;) {
			const at: number = code.slice(scanFrom).search(/"name"\s*:\s*"/)
			if (at === -1) {
				break
			}
			const absAt: number = scanFrom + at
			if (depth + braceDepthDelta(code.slice(0, absAt)) === 1) {
				return {line: i, at: absAt}
			}
			scanFrom = absAt + 1
		}
		depth = Math.max(0, depth + braceDepthDelta(code))
	}
	return null
}

/**
 * Staleness bar for the generated route tree: routeTree.gen.ts must contain
 * the _auth-dynamic route, or setup regenerates it and validate-setup fails
 * the gate. Single shared copy (setup's routes check + validate-setup).
 */
export const AUTH_DYNAMIC_ROUTE_MARKER = '_auth-dynamic'

export const REQUIRED_ENV_KEYS: Array<string> = [
	'DATABASE_URL',
	'ACCESS_TOKEN_SECRETS',
	'ANON_TOKEN_SECRETS',
	'REFRESH_TOKEN_SECRETS',
	'REFRESH_GRACE_TOKEN_SECRETS',
	'VITE_COOKIE_DOMAIN',
	'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE',
]

export type EnvIssue = {
	key: string
	problem: string
}

export type EnvValidation = {
	issues: Array<EnvIssue>
	overlaid: boolean
}

/** dotenv-compatible parse: `KEY=value`, one layer of matching quotes stripped. */
export function parseEnvFile(text: string): Map<string, string> {
	const vars = new Map<string, string>()
	for (const line of text.split('\n')) {
		let trimmed: string = line.trim()
		if (trimmed === '' || trimmed.startsWith('#')) {
			continue
		}
		// Tolerate `export KEY=value` (harmless in sourced files).
		if (trimmed.startsWith('export ') || trimmed.startsWith('export\t')) {
			trimmed = trimmed.slice('export'.length).trim()
		}
		const eq: number = trimmed.indexOf('=')
		if (eq <= 0) {
			continue
		}
		const key: string = trimmed.slice(0, eq).trim()
		if (key === '' || /[\s'"]/.test(key)) {
			continue
		}
		let value: string = trimmed.slice(eq + 1).trim()
		const quote: string = value.startsWith('"') ? '"' : value.startsWith("'") ? "'" : ''
		if (quote !== '') {
			// Quoted: honor `\"`/`\\`/`\n`/`\r`/`\t` escapes (setup's
			// envQuote writes them), end at the closing quote, and ignore
			// anything after it (trailing ` # comment` is not content).
			let out = ''
			let closed = false
			for (let i = 1; i < value.length; i += 1) {
				const ch: string = value[i] ?? ''
				if (quote === '"' && ch === '\\' && i + 1 < value.length) {
					const next: string = value[i + 1] ?? ''
					if (next === 'n') {
						out += '\n'
					} else if (next === 'r') {
						out += '\r'
					} else if (next === 't') {
						out += '\t'
					} else {
						out += next
					}
					i += 1
				} else if (ch === quote) {
					closed = true
					break
				} else {
					out += ch
				}
			}
			if (closed) {
				vars.set(key, out)
			} else {
				// Unterminated quote: keep the raw text so validation
				// reports a shape error ("does not parse as…") instead of
				// a misleading "missing" for a key that is plainly present.
				vars.set(key, value)
			}
			continue
		}
		vars.set(key, value)
	}
	return vars
}

/**
 * One TCP connect attempt. Shared by tools/setup/setup.ts (port scans) and
 * validate-setup (postgres reachability) so the two cannot drift apart;
 * lives here because both sides already import this dependency-free module.
 * First-wins resolve makes a settled guard unnecessary: whichever of
 * connect/timeout/error fires first decides, the rest are safe no-ops.
 */
export function probeTcp(host: string, port: number, timeoutMs: number): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		const socket = connect({host, port})
		socket.setTimeout(timeoutMs)
		socket.once('connect', () => {
			socket.destroy()
			resolve(true)
		})
		socket.once('timeout', () => {
			socket.destroy()
			resolve(false)
		})
		socket.once('error', () => {
			socket.destroy()
			resolve(false)
		})
	})
}

/** Mirror of the auth layer: comma-separated `id:secret` pairs, both sides non-empty. */
function isValidSecrets(value: string): boolean {
	for (const pair of value.split(',')) {
		const colon: number = pair.indexOf(':')
		if (colon <= 0) {
			return false
		}
		// Exactly one colon: the consumer splits on ':' and keeps the
		// first two segments, so a second colon would silently drop part
		// of the secret instead of failing loudly here.
		if (pair.indexOf(':', colon + 1) !== -1) {
			return false
		}
		if (pair.slice(0, colon) === '' || pair.slice(colon + 1) === '') {
			return false
		}
	}
	return true
}

export type EffectiveEnv = {
	vars: Map<string, string>
	/** true when `.env.local` exists and overrides the committed file */
	overlaid: boolean
	/** committed file only (no overlay) — callers needing a default baseline */
	devVars: Map<string, string>
}

/**
 * Effective config: committed `.env.development` overlaid by gitignored
 * `.env.local` (file order mirrors `dotenv -e .env.local -e .env.development`;
 * note dotenv-cli never overrides variables already in the process
 * environment, so `tools/setup/setup.ts` passes this overlay explicitly to its
 * children — see `refreshChildEnv`). Per-worktree overrides (branch database,
 * shifted ports) live in `.env.local`, written by `bun run setup`.
 */
export function loadEffectiveEnv(devPath: string, localPath: string): EffectiveEnv {
	const devVars: Map<string, string> = parseEnvFile(readFileSync(devPath, 'utf8'))
	const vars: Map<string, string> = new Map(devVars)
	const overlaid: boolean = existsSync(localPath)
	if (overlaid) {
		for (const [key, value] of parseEnvFile(readFileSync(localPath, 'utf8'))) {
			vars.set(key, value)
		}
	}
	return {vars, overlaid, devVars}
}

function isPostgresUrl(value: string): boolean {
	try {
		const url = new URL(value)
		return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
	} catch {
		return false
	}
}

/** Validate already-loaded vars (lets callers read the files once and reuse them). */
export function validateEnvVars(vars: Map<string, string>): Array<EnvIssue> {
	const issues: Array<EnvIssue> = []
	for (const key of REQUIRED_ENV_KEYS) {
		const value: string | undefined = vars.get(key)
		if (value === undefined || value === '') {
			issues.push({key, problem: 'is missing or empty'})
		}
	}
	const databaseUrl: string | undefined = vars.get('DATABASE_URL')
	if (databaseUrl !== undefined && databaseUrl !== '' && !isPostgresUrl(databaseUrl)) {
		issues.push({key: 'DATABASE_URL', problem: 'does not parse as a postgres:// URL'})
	}
	for (const key of [
		'ACCESS_TOKEN_SECRETS',
		'ANON_TOKEN_SECRETS',
		'REFRESH_TOKEN_SECRETS',
		'REFRESH_GRACE_TOKEN_SECRETS',
	]) {
		const value: string | undefined = vars.get(key)
		if (value !== undefined && value !== '' && !isValidSecrets(value)) {
			issues.push({key, problem: 'must be comma-separated `id:secret` pairs'})
		}
	}
	return issues
}

export function validateRequiredEnv(devPath: string, localPath: string | null): EnvValidation {
	const issues: Array<EnvIssue> = []
	if (!existsSync(devPath)) {
		return {
			issues: [{key: devPath, problem: 'file is missing (it is committed — restore it)'}],
			overlaid: false,
		}
	}
	const {vars, overlaid} =
		localPath === null
			? {vars: parseEnvFile(readFileSync(devPath, 'utf8')), overlaid: false}
			: loadEffectiveEnv(devPath, localPath)
	for (const issue of validateEnvVars(vars)) {
		issues.push(issue)
	}
	return {issues, overlaid}
}

function main(): void {
	const arg: string | undefined = process.argv[2]
	const path: string = arg === undefined || arg === '' ? '.env.development' : arg
	const {issues, overlaid} = validateRequiredEnv(path, '.env.local')
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

// basename compare, not endsWith: any *-validate-required-env.ts entrant
// importing this module would otherwise look "directly invoked" and run
// main() on import.
const invokedDirectly: boolean = basename(process.argv[1] ?? '') === 'validate-required-env.ts'
if (invokedDirectly) {
	main()
}

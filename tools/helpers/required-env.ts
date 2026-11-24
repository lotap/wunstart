import {existsSync, readFileSync} from 'node:fs'
import {basename} from 'node:path'

/**
 * Shared `.env` validation — single source of truth for env shape.
 *
 * `bun run validate-setup`, `app-identity`, and `branch-env` share the
 * loader and validator below (same functions in every flow).
 * Shapes mirror the runtime
 * consumers: `DATABASE_URL` per `src/db/index.ts`, `*_SECRETS` per
 * `src/db/ops/auth/_auth-layer.ts` (`id:secret` CSV pairs).
 *
 * Dependency-free (node builtins only) so app-identity can use it before
 * `bun install`. Library in tools/helpers: imported by the setup phases
 * and tools/pkg-scripts/validate-setup (tools/ never imports from src/).
 */

const REQUIRED_ENV_KEYS: Array<string> = [
	'DATABASE_URL',
	'ACCESS_TOKEN_SECRETS',
	'ANON_TOKEN_SECRETS',
	'REFRESH_TOKEN_SECRETS',
	'REFRESH_GRACE_TOKEN_SECRETS',
	'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE',
]

type EnvIssue = {
	key: string
	problem: string
}

export type EnvValidation = {
	issues: Array<EnvIssue>
	overlaid: boolean
}

/**
 * One assignment line, matching dotenv's grammar: `KEY=value` or
 * `KEY: value` (colon needs whitespace, as in dotenv), optional `export`,
 * keys limited to word characters, dots, and hyphens. Null for comments,
 * blanks, and unparseable lines.
 */
const ENV_LINE = /^\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)([\s\S]*)$/

type EnvLine = {key: string; value: string}

function parseEnvLine(line: string): EnvLine | null {
	const match: RegExpExecArray | null = ENV_LINE.exec(line)

	if (match === null) {
		return null
	}

	const key: string | undefined = match[1]
	const value: string | undefined = match[2]

	if (key === undefined) {
		return null
	}

	return {key, value: value ?? ''}
}

/** Key of an env assignment line (shared with branch-env's .env.local rewrite). */
export function envKeyOf(line: string): string | null {
	return parseEnvLine(line)?.key ?? null
}

/**
 * dotenv-compatible parse: one layer of matching quotes stripped, unquoted
 * ` #` comments cut (dotenv truncates at the first `#`, even mid-word —
 * matching it keeps branch-env's overlay identical to what dev/db actually
 * read). Quoted values already ignore trailing comments. No `${VAR}`
 * expansion (dotenv core does not expand either — only dotenv-cli's preload
 * does, against real process env, which a static parse must never depend
 * on). Managed keys are quoted and `$`-escaped by envQuote, so they
 * round-trip exactly through both readers; a hand-edited unquoted `$`
 * diverges (dotenv-cli expands, this keeps it literal) — quote values
 * containing `$`.
 */
function parseEnvFile(text: string): Map<string, string> {
	const vars = new Map<string, string>()

	for (const line of text.split('\n')) {
		const parsed: EnvLine | null = parseEnvLine(line)

		if (parsed === null) {
			continue
		}

		const {key} = parsed
		let value: string = parsed.value.trim()

		// Unquoted: cut at the first `#` like dotenv does (see above).
		if (!value.startsWith('"') && !value.startsWith("'") && !value.startsWith('`')) {
			const hash: number = value.indexOf('#')
			value = (hash === -1 ? value : value.slice(0, hash)).trimEnd()
		}

		let quote = ''

		if (value.startsWith('"')) {
			quote = '"'
		} else if (value.startsWith("'")) {
			quote = "'"
		} else if (value.startsWith('`')) {
			quote = '`'
		}

		if (quote !== '') {
			// Quoted: honor `\"`/`\\`/`\n`/`\r`/`\t` escapes (branch-env's
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

/** Parse one env file without overlaying anything. */
export function loadEnvFile(path: string): Map<string, string> {
	return parseEnvFile(readFileSync(path, 'utf8'))
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
 * `.env.local` (file order mirrors the `--override` scripts: development
 * first, local second, last file winning; exported vars lose to files
 * there — except the VPS cron entries (`archive-old-activities`,
 * `purge-auth-attempts`), which keep the old chain so an exported
 * `DATABASE_URL` wins. This static parse never sees process.env, so branch-env passes
 * the overlay explicitly to its children — see `refreshChildEnv`.
 * Per-worktree overrides (branch database, shifted ports) live in
 * `.env.local`, written by `bun run branch-env`.
 */
export function loadEffectiveEnv(devPath: string, localPath: string): EffectiveEnv {
	const devVars: Map<string, string> = loadEnvFile(devPath)
	const vars: Map<string, string> = new Map(devVars)
	const overlaid: boolean = existsSync(localPath)

	if (overlaid) {
		for (const [key, value] of loadEnvFile(localPath)) {
			vars.set(key, value)
		}
	}

	return {vars, overlaid, devVars}
}

export type EnvReadFailure = {culprit: string; hint: string}

/**
 * Explain which env file broke a read and how to recover. The committed
 * file reads first, so a readable dev file moves the blame to the overlay;
 * a custom path keeps generic wording.
 */
export function envReadFailure(devPath: string, localPath: string): EnvReadFailure {
	let culprit: string = devPath

	try {
		readFileSync(devPath, 'utf8')
		culprit = localPath
	} catch {
		// The committed file itself is the culprit.
	}

	if (culprit === localPath) {
		return {
			culprit,
			hint: 'delete it (gitignored) or fix its permissions, then re-run',
		}
	}

	if (basename(culprit) === '.env.development') {
		return {culprit, hint: 'restore it: git checkout -- .env.development'}
	}

	return {culprit, hint: 'check the path and its permissions'}
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

export function validateRequiredEnv(devPath: string, localPath: string): EnvValidation {
	const issues: Array<EnvIssue> = []

	if (!existsSync(devPath)) {
		return {
			issues: [{key: devPath, problem: 'file is missing (it is committed — restore it)'}],
			overlaid: false,
		}
	}

	const {vars, overlaid} = loadEffectiveEnv(devPath, localPath)

	for (const issue of validateEnvVars(vars)) {
		issues.push(issue)
	}

	return {issues, overlaid}
}

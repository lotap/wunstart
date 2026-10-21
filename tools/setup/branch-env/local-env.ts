// .env.local read-modify-write. Managed keys are the only lines branch-env
// rewrites; headers are refreshed and trailing blank lines dropped,
// everything else survives verbatim. .env.local is branch-local operational
// state owned by this phase.

import {chmodSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

import {writeFileAtomic} from '../../helpers/fs-write.ts'
import {fail, ok} from '../../helpers/output.ts'
import {ROOT} from '../../helpers/paths.ts'
import {envKeyOf} from '../../helpers/required-env.ts'
import {refreshChildEnv} from './process.ts'

/**
 * Fixed list (not managed.keys()): a key must be dropped from kept lines
 * even on runs where it is not written (DATABASE_URL may already match the
 * committed URL; MAILPIT_URL is only pinned when shifted). If branch-env
 * manages a new key, add it here.
 */
const MANAGED_ENV_KEYS: Set<string> = new Set(['DATABASE_URL', 'DEV_PORT', 'MAILPIT_URL'])

/**
 * Quote an env value. Backslashes, double quotes, tabs, line breaks, and
 * `$` are escaped: dotenv-cli expands `$VAR`/`${VAR}` on read, so an
 * unescaped `$` (a password) corrupts on the next read. Only the `$`
 * round-trips exactly through both readers (dotenv-cli natively,
 * parseEnvFile's backslash branch); the other backslash escapes are
 * parseEnvFile-only, which is fine — every managed key is a URL/port, and
 * `$` is the only special char reachable in a DATABASE_URL password.
 */
function envQuote(value: string): string {
	return `"${value.replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}"`
}

/**
 * Merge managed overrides into .env.local, preserving unmanaged lines
 * verbatim, then refresh the child env so later spawns see the new values.
 */
export function persistLocal(managed: Map<string, string>): void {
	for (const key of managed.keys()) {
		if (!MANAGED_ENV_KEYS.has(key)) {
			fail(
				`unmanaged key '${key}' passed to persistLocal`,
				'add it to MANAGED_ENV_KEYS in tools/setup/branch-env/local-env.ts',
			)
		}
	}
	const localPath: string = join(ROOT, '.env.local')
	let previous: string | null
	try {
		previous = readFileSync(localPath, 'utf8')
	} catch {
		previous = null
	}
	const keptRaw: Array<string> = []
	if (previous !== null) {
		for (const line of previous.split('\n')) {
			const stripped: string = line.trimStart()
			if (stripped.startsWith('# auto-written by') || stripped.startsWith('# Delete this file')) {
				continue
			}
			const key: string | null = envKeyOf(line)
			if (key !== null && MANAGED_ENV_KEYS.has(key)) {
				continue
			}
			keptRaw.push(line)
		}
		while (keptRaw.length > 0 && keptRaw[keptRaw.length - 1] === '') {
			keptRaw.pop()
		}
	}
	const lines: Array<string> = [
		'# auto-written by branch-env — per-worktree overrides (gitignored).',
		'# Delete this file and re-run branch-env to regenerate its managed keys.',
	]
	for (const [key, value] of managed) {
		lines.push(`${key}=${envQuote(value)}`)
	}
	for (const line of keptRaw) {
		lines.push(line)
	}
	const wanted: string = `${lines.join('\n')}\n`
	const needsWrite: boolean = previous !== wanted
	if (!needsWrite) {
		try {
			chmodSync(localPath, 0o600)
		} catch {
			// Non-fatal (exotic filesystems); the content is correct.
		}
		return
	}
	writeFileAtomic(localPath, wanted, 0o600)
	ok('.env.local written (per-worktree overrides)')
	refreshChildEnv()
}

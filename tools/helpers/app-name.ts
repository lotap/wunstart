// The app name: locating it in JSONC config and validating it as a
// deployable slug. The name is what configs carry; the slug is its
// deployable shape (workers.dev subdomain) — find feeds validate
// (checkNames extracts then checks; the rename path finds then heals).
// app-identity's flag, prompt, and rename paths, branch-env's prerequisite
// check, and validate-setup's names check all enforce the same rule, so it lives
// apart from any of them. A second, unrelated rule does not belong
// here (AGENTS.md Placement).

/** Null when the value is a deployable app slug, else the reason it is not. */
export function isValidSlug(value: string): string | null {
	// 63 chars: the workers.dev subdomain cap (and wrangler's interactive
	// ceiling), binding where npm's 214 is not. A longer alphabet-clean
	// name would pass here and fail at deploy instead.
	if (value.length > 63) {
		return 'keep it to 63 characters or fewer (workers.dev subdomain cap)'
	}
	// Trailing hyphens are rejected too: npm tolerates them but worker
	// names (Cloudflare) must end alphanumeric, so allowing `foo-` here
	// just moves the failure to deploy.
	if (value === '' || /[^a-z0-9-]/.test(value) || value.startsWith('-') || value.endsWith('-')) {
		return 'use lowercase letters, digits, and hyphens, starting with a letter or digit and not ending with a hyphen'
	}
	return null
}

/** Scanner state threaded across lines: block comments can span lines. */
type JsoncState = {inBlock: boolean}

/**
 * Strip `//` and `/* *\/` comments from a JSONC line, string-aware: comment
 * markers inside a quoted value (e.g. `"url": "https://…"`) are content, not
 * comments — otherwise a brace or `"name"` inside a comment skews depth
 * tracking in findTopLevelName. Length-preserving: stripped comment chars
 * become spaces, so char offsets stay aligned with the raw line (the finder
 * returns a raw-line offset that the rename and the names check apply to
 * the unstripped text).
 */
function stripJsoncLine(line: string, state: JsoncState): string {
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
 * Extract the `"name"` value at a finder location (from the qualified
 * offset, not the first match on the line: a minified line can hold a
 * nested `"name"` first). Null when the line or match is absent. Single
 * shared copy: app-identity's rename and validate-setup's names check use this.
 */
export function extractTopLevelName(
	lines: Array<string>,
	found: TopLevelName | null,
): string | null {
	if (found === null) {
		return null
	}
	const line: string | undefined = lines[found.line]
	if (line === undefined) {
		return null
	}
	const match: RegExpExecArray | null = /"name"\s*:\s*"([^"]*)"/.exec(line.slice(found.at))
	if (match === null) {
		return null
	}
	const raw: string | undefined = match[1]
	return raw ?? null
}

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
 * app-identity (rename) and validate-setup (names check) use this.
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

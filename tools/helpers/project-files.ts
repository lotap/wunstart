/* oxlint-disable anti-slop/no-runtime-typeof -- package.json is untyped JSON; typeof narrowing at the boundary is the parse */
/* oxlint-disable anti-slop/no-unsafe-dictionary-type -- package.json is untyped JSON by nature */

// Reads of committed project files shared by the setup phases and the
// health check: package.json, wrangler.jsonc, src/app-info.ts, the wasm
// kernel, and the generated route tree. Also owns the app-info field
// locator shared by its reader and the identity writer. Readers return
// data or null; the caller owns the failure wording.

import {existsSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'

import {extractTopLevelName, findTopLevelName} from './app-name.ts'
import {ROOT} from './paths.ts'

export type PackageJsonFile = {
	path: string
	value: Record<string, unknown>
	indent: string
	name: string
	description: string
	packageManager: string | undefined
}

export type PackageJsonRead =
	| {ok: true; file: PackageJsonFile}
	| {ok: false; reason: 'unreadable' | 'invalid'}

export function readPackageJson(): PackageJsonRead {
	const path: string = join(ROOT, 'package.json')
	let raw: string
	try {
		raw = readFileSync(path, 'utf8')
	} catch {
		return {ok: false, reason: 'unreadable'}
	}
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		return {ok: false, reason: 'invalid'}
	}
	// A valid JSON document is not necessarily a package manifest: `null`,
	// arrays, and scalars must fail here, not as a property-access crash or
	// a silent no-op write later.
	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return {ok: false, reason: 'invalid'}
	}
	// SAFETY: the plain-object guard above narrows JSON.parse's unknown.
	const value = parsed as Record<string, unknown>
	return {
		ok: true,
		file: {
			path,
			value,
			indent: /^( +|\t+)/m.exec(raw)?.[1] ?? '\t',
			name: typeof value['name'] === 'string' ? value['name'] : '',
			description: typeof value['description'] === 'string' ? value['description'] : '',
			packageManager:
				typeof value['packageManager'] === 'string' ? value['packageManager'] : undefined,
		},
	}
}

export type AppInfoFile = {
	path: string
	text: string
	name: string | undefined
	description: string | undefined
}

/** Location of a quoted value in the top-level `appInfo` object. */
export type AppInfoFieldSpan = {start: number; end: number; raw: string}

export type AppInfoFieldSpans = {
	name?: AppInfoFieldSpan
	description?: AppInfoFieldSpan
}

function isIdentStart(ch: string): boolean {
	return /[A-Za-z_$]/.test(ch)
}

function isIdentPart(ch: string): boolean {
	return /[A-Za-z0-9_$]/.test(ch)
}

/**
 * Locate the top-level `name` and `description` string fields of the
 * exported `appInfo` object. This is the one contract shared by the reader
 * and the setup writer: scanning stops at depth 1 and only admits
 * identifiers at a property boundary, so a nested object or a ternary that
 * happens to contain `name` or `description` can never be mistaken for the
 * managed fields. Comments, quoted strings, and template literals are
 * skipped while tracking braces.
 */
export function findAppInfoFields(text: string): AppInfoFieldSpans | null {
	const declaration: RegExpExecArray | null = /\bexport\s+const\s+appInfo\b/.exec(text)
	if (declaration === null) {
		return null
	}
	const equals: number = text.indexOf('=', declaration.index + declaration[0].length)
	if (equals === -1) {
		return null
	}
	const open: number = text.indexOf('{', equals + 1)
	if (open === -1) {
		return null
	}
	const fields: AppInfoFieldSpans = {}
	let depth = 1
	let brackets = 0
	let parens = 0
	let atPropertyStart = true
	let inString: string | null = null
	let escaped = false
	let inLineComment = false
	let inBlockComment = false
	for (let i = open + 1; i < text.length; i += 1) {
		const ch: string = text.charAt(i)
		const next: string = text.charAt(i + 1)
		if (inLineComment) {
			if (ch === '\n') {
				inLineComment = false
			}
			continue
		}
		if (inBlockComment) {
			if (ch === '*' && next === '/') {
				inBlockComment = false
				i += 1
			}
			continue
		}
		if (inString !== null) {
			if (escaped) {
				escaped = false
			} else if (ch === '\\') {
				escaped = true
			} else if (ch === inString) {
				inString = null
			}
			continue
		}
		if (ch === '/' && next === '/') {
			inLineComment = true
			i += 1
			continue
		}
		if (ch === '/' && next === '*') {
			inBlockComment = true
			i += 1
			continue
		}
		if (/\s/.test(ch)) {
			continue
		}
		if (ch === "'" || ch === '"' || ch === '`') {
			inString = ch
			atPropertyStart = false
			continue
		}
		if (ch === '{') {
			depth += 1
			atPropertyStart = false
			continue
		}
		if (ch === '}') {
			depth -= 1
			atPropertyStart = false
			if (depth === 0) {
				return fields
			}
			continue
		}
		if (ch === '[') {
			brackets += 1
			atPropertyStart = false
			continue
		}
		if (ch === ']') {
			brackets = Math.max(0, brackets - 1)
			atPropertyStart = false
			continue
		}
		if (ch === '(') {
			parens += 1
			atPropertyStart = false
			continue
		}
		if (ch === ')') {
			parens = Math.max(0, parens - 1)
			atPropertyStart = false
			continue
		}
		if (ch === ',') {
			atPropertyStart = depth === 1 && brackets === 0 && parens === 0
			continue
		}
		if (depth !== 1 || brackets !== 0 || parens !== 0 || !atPropertyStart || !isIdentStart(ch)) {
			atPropertyStart = false
			continue
		}
		const keyStart = i
		let keyEnd = i + 1
		while (keyEnd < text.length && isIdentPart(text.charAt(keyEnd))) {
			keyEnd += 1
		}
		const key: string = text.slice(keyStart, keyEnd)
		if (key !== 'name' && key !== 'description') {
			atPropertyStart = false
			i = keyEnd - 1
			continue
		}
		let colon: number = keyEnd
		while (colon < text.length && /\s/.test(text.charAt(colon))) {
			colon += 1
		}
		if (text.charAt(colon) !== ':') {
			atPropertyStart = false
			i = keyEnd - 1
			continue
		}
		let valueAt: number = colon + 1
		while (valueAt < text.length && /\s/.test(text.charAt(valueAt))) {
			valueAt += 1
		}
		const quote: string = text.charAt(valueAt)
		if (quote !== "'" && quote !== '"') {
			atPropertyStart = false
			i = valueAt - 1
			continue
		}
		let valueEnd = valueAt + 1
		let valueEscaped = false
		let closed = false
		for (; valueEnd < text.length; valueEnd += 1) {
			const valueCh: string = text.charAt(valueEnd)
			if (valueEscaped) {
				valueEscaped = false
			} else if (valueCh === '\\') {
				valueEscaped = true
			} else if (valueCh === quote) {
				closed = true
				break
			} else if (valueCh === '\n' || valueCh === '\r') {
				break
			}
		}
		if (!closed) {
			return null
		}
		const span: AppInfoFieldSpan = {
			start: valueAt,
			end: valueEnd + 1,
			raw: text.slice(valueAt + 1, valueEnd),
		}
		if (key === 'name' && fields.name === undefined) {
			fields.name = span
		}
		if (key === 'description' && fields.description === undefined) {
			fields.description = span
		}
		atPropertyStart = false
		i = valueEnd
	}
	return null
}

/** Decode the escapes the writer emits and TS allows in these fields. */
export function decodeAppInfoValue(raw: string): string {
	return raw.replace(/\\([\\nrt'"])/g, (_escaped: string, char: string) =>
		char === 'n' ? '\n' : char === 'r' ? '\r' : char === 't' ? '\t' : char,
	)
}

export function readAppInfoFile(): AppInfoFile | null {
	const path: string = join(ROOT, 'src', 'app-info.ts')
	let text: string
	try {
		text = readFileSync(path, 'utf8')
	} catch {
		return null
	}
	const fields: AppInfoFieldSpans | null = findAppInfoFields(text)
	return {
		path,
		text,
		name: fields?.name === undefined ? undefined : decodeAppInfoValue(fields.name.raw),
		description:
			fields?.description === undefined ? undefined : decodeAppInfoValue(fields.description.raw),
	}
}

export function readWorkerName(): string | null {
	const path: string = join(ROOT, 'wrangler.jsonc')
	let text: string
	try {
		text = readFileSync(path, 'utf8')
	} catch {
		return null
	}
	const lines: Array<string> = text.split('\n')
	const found = findTopLevelName(lines)
	return extractTopLevelName(lines, found)
}

/** Wasm kernel presence and size; a directory is not a kernel. */
export function wasmState() {
	const path: string = join(ROOT, 'src', 'durable-objects', 'argon2-do-hasher.wasm')
	try {
		const stat = statSync(path)
		return {present: stat.isFile(), bytes: stat.isFile() ? stat.size : 0}
	} catch {
		return {present: false, bytes: 0}
	}
}

/**
 * Generated route tree presence. Callers that need freshness run the
 * native generator; a marker or mtime guess drifts as soon as a route is
 * added or renamed.
 */
export function routeTreePresent(): boolean {
	return existsSync(join(ROOT, 'src', 'routeTree.gen.ts'))
}

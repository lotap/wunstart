// Identity files: readers, the app-info field patcher, and the state-free
// synchronization across package.json, wrangler.jsonc, src/app-info.ts,
// public/llms.txt, and CONTEXT.md.

import {readFileSync, statSync, utimesSync} from 'node:fs'
import {join} from 'node:path'

import type {TopLevelName} from '../../helpers/app-name.ts'
import {extractTopLevelName, findTopLevelName} from '../../helpers/app-name.ts'
import {writeFileIfChanged} from '../../helpers/fs-write.ts'
import {fail, ok, warn} from '../../helpers/output.ts'
import {ROOT} from '../../helpers/paths.ts'
import type {AppInfoFieldSpan, AppInfoFile, PackageJsonFile} from '../../helpers/project-files.ts'
import {
	decodeAppInfoValue,
	findAppInfoFields,
	readAppInfoFile,
	readPackageJson,
} from '../../helpers/project-files.ts'

function singleQuote(value: string): string {
	return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')}'`
}

function readPackageFile(): PackageJsonFile {
	const pkg = readPackageJson()
	if (!pkg.ok) {
		const problem: string = pkg.reason === 'invalid' ? 'not valid JSON' : 'unreadable'
		fail(`package.json is ${problem}`, 'restore it: git checkout -- package.json')
	}
	return pkg.file
}

export type AppInfoIdentityFile = AppInfoFile & {name: string; description: string}

/**
 * src/app-info.ts is a committed user-owned module: only its name and
 * description fields are managed here, so other universal values and
 * comments survive every run. A missing file or field is a restore case,
 * never a regeneration case.
 */
function readAppInfo(): AppInfoIdentityFile {
	const file: AppInfoFile | null = readAppInfoFile()
	if (file === null) {
		fail('src/app-info.ts is missing or unreadable', 'restore it: git checkout -- src/app-info.ts')
	}
	if (file.name === undefined || file.description === undefined) {
		fail(
			'src/app-info.ts is missing its name or description field',
			'restore it: git checkout -- src/app-info.ts',
		)
	}
	return {path: file.path, text: file.text, name: file.name, description: file.description}
}

export type WranglerFile = {
	path: string
	lines: Array<string>
	index: number
	at: number
	name: string
}

function readWranglerFile(): WranglerFile {
	const path: string = join(ROOT, 'wrangler.jsonc')
	let text: string
	try {
		text = readFileSync(path, 'utf8')
	} catch {
		fail('wrangler.jsonc is missing or unreadable', 'restore it: git checkout -- wrangler.jsonc')
	}
	const lines: Array<string> = text.split('\n')
	const found: TopLevelName | null = findTopLevelName(lines)
	if (found === null) {
		fail(
			'could not read the top-level worker name from wrangler.jsonc',
			'restore it: git checkout -- wrangler.jsonc',
		)
	}
	const name: string | null = extractTopLevelName(lines, found)
	if (name === null) {
		fail(
			'could not read the top-level worker name from wrangler.jsonc',
			'restore it: git checkout -- wrangler.jsonc',
		)
	}
	return {path, lines, index: found.line, at: found.at, name}
}

function readLinesFile(path: string, label: string) {
	let text: string
	try {
		text = readFileSync(path, 'utf8')
	} catch {
		fail(`${label} is missing or unreadable`, `restore it: git checkout -- ${label}`)
	}
	return {path, lines: text.split('\n')}
}

export type LlmsFile = {path: string; lines: Array<string>}

function readLlmsFile(): LlmsFile {
	return readLinesFile(join(ROOT, 'public', 'llms.txt'), 'public/llms.txt')
}

export type ContextFile = {path: string; lines: Array<string>}

function readContextFile(): ContextFile {
	return readLinesFile(join(ROOT, 'CONTEXT.md'), 'CONTEXT.md')
}

export type IdentitySnapshot = {
	pkg: PackageJsonFile
	wrangler: WranglerFile
	appInfo: AppInfoIdentityFile
	llms: LlmsFile
	context: ContextFile
}

export function readIdentitySnapshot(): IdentitySnapshot {
	return {
		pkg: readPackageFile(),
		wrangler: readWranglerFile(),
		appInfo: readAppInfo(),
		llms: readLlmsFile(),
		context: readContextFile(),
	}
}

export type IdentityValues = {
	name: string
	description: string
	prevName: string
	prevDescription: string
}

/**
 * Current values, with package.json as the committed source of truth and
 * app-info as the last-write marker the llms sync heals from.
 */
export function identityValues(snapshot: IdentitySnapshot): IdentityValues {
	const appName: string = snapshot.appInfo.name
	const name: string =
		snapshot.pkg.name !== '' ? snapshot.pkg.name : appName !== '' ? appName : snapshot.wrangler.name
	const description: string =
		snapshot.pkg.description !== '' ? snapshot.pkg.description : snapshot.appInfo.description
	return {
		name,
		description,
		prevName: appName !== '' ? appName : snapshot.pkg.name,
		prevDescription: snapshot.appInfo.description,
	}
}

type SyncInputs = {
	wantTitle: string
	prevTitle: string | null
	finalDescription: string
	prevDescription: string | undefined
}

/**
 * End of the lead paragraph: the index of the first `## ` heading, or the
 * end of the file. The managed description is the single `> ` line under
 * the title; blockquotes later in the file are user content, never the
 * managed slot.
 */
function leadParagraphEnd(lines: Array<string>): number {
	const at: number = lines.findIndex((line) => line.startsWith('## '))
	return at === -1 ? lines.length : at
}

/** The managed description line, when present in the lead paragraph. */
function findLeadDescription(lines: Array<string>): string | undefined {
	return lines
		.slice(0, leadParagraphEnd(lines))
		.find((line) => line.startsWith('> ') || line === '>')
}

/**
 * Pure paragraph sync: returns the new lines, or null when untouched.
 * Title and paragraph track the last-written values (a re-rename swaps
 * `# <previous>` for `# <next>`); anything else means the user hand-edited
 * those lines, so they stay put.
 */
function syncLlmsLines(llmsLines: Array<string>, inputs: SyncInputs): Array<string> | null {
	const {wantTitle, prevTitle, finalDescription, prevDescription} = inputs
	const newDescLine: string = `> ${finalDescription}`
	const prevDescLine: string | null = prevDescription !== undefined ? `> ${prevDescription}` : null
	const lines: Array<string> = [...llmsLines]
	let touched = false
	let descriptionTouched = false
	for (let i = 0; i < lines.length; i += 1) {
		const line: string = lines[i] ?? ''
		if (prevTitle !== null && line === prevTitle && line !== wantTitle) {
			lines[i] = wantTitle
			touched = true
		}
		if (
			finalDescription !== '' &&
			(line.startsWith('> TODO(setup)') ||
				(prevDescLine !== null && line === prevDescLine && line !== newDescLine))
		) {
			lines[i] = newDescLine
			touched = true
			descriptionTouched = true
		} else if (
			finalDescription === '' &&
			(line.startsWith('> TODO(setup)') || (prevDescLine !== null && line === prevDescLine))
		) {
			lines.splice(i, 1)
			while (lines[i - 1] === '' && lines[i] === '') {
				lines.splice(i, 1)
			}
			i -= 1
			touched = true
		}
	}
	if (
		finalDescription !== '' &&
		!descriptionTouched &&
		!lines.includes(newDescLine) &&
		findLeadDescription(lines) === undefined
	) {
		const titleIndex: number = lines.findIndex((line) => line.startsWith('# '))
		if (titleIndex !== -1) {
			if (lines[titleIndex + 1] !== '') {
				lines.splice(titleIndex + 1, 0, '')
			}
			const insertAt: number = titleIndex + 2
			lines.splice(insertAt, 0, newDescLine)
			const gap: number = insertAt + 1
			while (lines[gap] === '' && lines[gap + 1] === '') {
				lines.splice(gap, 1)
			}
			if (lines[gap] !== '' && lines[gap] !== undefined) {
				lines.splice(gap, 0, '')
			}
			touched = true
		}
	}
	if (!touched) {
		return null
	}
	if (lines[lines.length - 1] !== '') {
		lines.push('')
	}
	return lines
}

function syncLlms(llms: LlmsFile, values: IdentityValues, target: IdentityTarget): void {
	const wantTitle: string = `# ${target.name}`
	const prevTitle: string | null = values.prevName !== '' ? `# ${values.prevName}` : null
	const synced: Array<string> | null = syncLlmsLines(llms.lines, {
		wantTitle,
		prevTitle,
		finalDescription: target.description,
		prevDescription: values.prevDescription !== '' ? values.prevDescription : undefined,
	})
	const lines: Array<string> = synced ?? llms.lines
	if (synced !== null && writeFileIfChanged(llms.path, lines.join('\n'))) {
		ok('public/llms.txt updated')
	}
	const titleLine: string | undefined = lines.find((line) => line.startsWith('# '))
	if (titleLine === undefined) {
		warn(
			'public/llms.txt has no top-level title — identity not synchronized (restore it: git checkout -- public/llms.txt)',
		)
		return
	}
	if (titleLine !== wantTitle) {
		warn(
			prevTitle === null
				? `public/llms.txt title '${titleLine}' does not match '${wantTitle}' — left untouched (hand-edited?)`
				: `public/llms.txt title '${titleLine}' did not match the last-written value — left untouched (hand-edited?)`,
		)
	}
	const descriptionLine: string | undefined = findLeadDescription(lines)
	if (target.description !== '') {
		if (descriptionLine !== `> ${target.description}`) {
			warn(
				'public/llms.txt description did not match the resolved one — left untouched (hand-edited?)',
			)
		}
		return
	}
	if (descriptionLine !== undefined) {
		warn('public/llms.txt still has a description line — left untouched (hand-edited?)')
	}
}

/**
 * CONTEXT.md is title-managed only: the file is the built app's glossary,
 * so the one-line app description never belongs in it (it would bloat every
 * agent read). The sync below swaps the title on rename; everything below
 * the title is user-owned glossary content and is never touched.
 */
function syncContextLines(
	contextLines: Array<string>,
	inputs: {wantTitle: string; prevTitle: string | null},
): Array<string> | null {
	const {wantTitle, prevTitle} = inputs
	const lines: Array<string> = [...contextLines]
	const titleIndex: number = lines.findIndex((line) => line.startsWith('# '))
	if (
		titleIndex === -1 ||
		prevTitle === null ||
		lines[titleIndex] !== prevTitle ||
		lines[titleIndex] === wantTitle
	) {
		return null
	}
	lines[titleIndex] = wantTitle
	if (lines[lines.length - 1] !== '') {
		lines.push('')
	}
	return lines
}

function syncContext(context: ContextFile, values: IdentityValues, target: IdentityTarget): void {
	const wantTitle: string = `# ${target.name}`
	const prevTitle: string | null = values.prevName !== '' ? `# ${values.prevName}` : null
	const synced: Array<string> | null = syncContextLines(context.lines, {
		wantTitle,
		prevTitle,
	})
	const lines: Array<string> = synced ?? context.lines
	if (synced !== null && writeFileIfChanged(context.path, lines.join('\n'))) {
		ok('CONTEXT.md updated')
	}
	const titleLine: string | undefined = lines.find((line) => line.startsWith('# '))
	if (titleLine === undefined) {
		warn(
			'CONTEXT.md has no top-level title — identity not synchronized (restore it: git checkout -- CONTEXT.md)',
		)
		return
	}
	if (titleLine !== wantTitle) {
		warn(
			prevTitle === null
				? `CONTEXT.md title '${titleLine}' does not match '${wantTitle}' — left untouched (hand-edited?)`
				: `CONTEXT.md title '${titleLine}' did not match the last-written value — left untouched (hand-edited?)`,
		)
	}
}

/**
 * Replace the two managed fields in place. Everything else in the file —
 * other properties, comments, formatting — is preserved. The shared
 * locator guarantees the write lands on the top-level fields, and a
 * read-back check turns any future drift into a loud failure.
 */
function patchAppInfoText(text: string, name: string, description: string): string | null {
	const fields = findAppInfoFields(text)
	if (fields?.name === undefined || fields.description === undefined) {
		return null
	}
	const replacements: Array<{field: AppInfoFieldSpan; value: string}> = [
		{field: fields.name, value: name},
		{field: fields.description, value: description},
	]
	replacements.sort((a, b) => b.field.start - a.field.start)
	let patched: string = text
	for (const {field, value} of replacements) {
		patched = patched.slice(0, field.start) + singleQuote(value) + patched.slice(field.end)
	}
	const written = findAppInfoFields(patched)
	if (written?.name === undefined || written.description === undefined) {
		return null
	}
	if (
		decodeAppInfoValue(written.name.raw) !== name ||
		decodeAppInfoValue(written.description.raw) !== description
	) {
		return null
	}
	return patched
}

export type IdentityTarget = {
	name: string
	description: string
}

/**
 * Apply the resolved identity. Every write is content-compared, so a rerun
 * with nothing to change is a no-op. app-info.ts is written last: it is the
 * last-write marker that heals a partially completed rename. Lockfiles keep
 * their old root name until install-deps regenerates the active one.
 */
export function applyIdentity(
	snapshot: IdentitySnapshot,
	values: IdentityValues,
	target: IdentityTarget,
): void {
	const pkg: PackageJsonFile = snapshot.pkg
	const appInfoText: string | null = patchAppInfoText(
		snapshot.appInfo.text,
		target.name,
		target.description,
	)
	if (appInfoText === null) {
		fail(
			'src/app-info.ts has no writable top-level name and description fields',
			'restore it: git checkout -- src/app-info.ts',
		)
	}
	// Identity edits never change dependencies, so keep package.json's old
	// mtime across the rewrite: install-deps uses that timestamp as its
	// staleness boundary and must not reinstall after a pure rename.
	let pkgTime: number | null
	try {
		pkgTime = statSync(pkg.path).mtimeMs
	} catch {
		pkgTime = null
	}
	let pkgChanged = false
	if (pkg.value['name'] !== target.name) {
		pkg.value['name'] = target.name
		pkgChanged = true
	}
	if (pkg.value['description'] !== target.description) {
		pkg.value['description'] = target.description
		pkgChanged = true
	}
	if (
		pkgChanged &&
		writeFileIfChanged(pkg.path, `${JSON.stringify(pkg.value, null, pkg.indent)}\n`)
	) {
		ok('package.json identity updated')
		if (pkgTime !== null) {
			try {
				utimesSync(pkg.path, new Date(pkgTime), new Date(pkgTime))
			} catch {
				// Non-fatal: worst case is one redundant install next run.
			}
		}
	}
	if (snapshot.wrangler.name !== target.name) {
		const line: string = snapshot.wrangler.lines[snapshot.wrangler.index] ?? ''
		snapshot.wrangler.lines[snapshot.wrangler.index] =
			line.slice(0, snapshot.wrangler.at) +
			line.slice(snapshot.wrangler.at).replace(/"name"\s*:\s*"[^"]*"/, `"name": "${target.name}"`)
		if (
			extractTopLevelName(snapshot.wrangler.lines, {
				line: snapshot.wrangler.index,
				at: snapshot.wrangler.at,
			}) !== target.name
		) {
			fail(
				'could not write the top-level worker name to wrangler.jsonc',
				'restore it: git checkout -- wrangler.jsonc',
			)
		}
		if (writeFileIfChanged(snapshot.wrangler.path, snapshot.wrangler.lines.join('\n'))) {
			ok(`wrangler.jsonc worker name -> ${target.name}`)
		}
	}
	syncContext(snapshot.context, values, target)
	syncLlms(snapshot.llms, values, target)
	if (writeFileIfChanged(snapshot.appInfo.path, appInfoText)) {
		ok('src/app-info.ts identity updated')
	}
}

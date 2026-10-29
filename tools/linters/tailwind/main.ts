import {spawn} from 'node:child_process'
import {readdir, readFile, stat as statPath} from 'node:fs/promises'
import {createRequire} from 'node:module'
import {dirname, extname, join, relative, resolve as resolvePath, sep} from 'node:path'
import {pathToFileURL} from 'node:url'

type JsonValue = string | number | boolean | null | JsonValue[] | {[key: string]: JsonValue}

type JsonRpcMessage = {
	jsonrpc: '2.0'
	id?: number
	method?: string
	params?: JsonValue
	result?: JsonValue
	error?: {message: string}
}

type TailwindDiagnostic = {
	code?: string | number
	message: string
	source?: string
	range: {start: {line: number; character: number}}
}

type ServerMessage = {
	jsonrpc: '2.0'
	id?: number
	method?: string
	params?: {
		items?: Array<{section: string}>
		uri?: string
		diagnostics?: TailwindDiagnostic[]
	}
	result?: JsonValue
	error?: {message: string}
}

type LintRow = {
	file: string
	line: number
	character: number
	message: string
	code: string
}

const root = process.cwd()

const ignoredDirectories = new Set([
	'.git',
	'.tanstack',
	'.tmp',
	'.wrangler',
	'dist',
	'node_modules',
])

const ignoredFiles = new Set(['routeTree.gen.ts', 'worker-configuration.d.ts'])

const supportedExtensions = new Set(['.css', '.ts', '.tsx'])

const tailwindConfig = {
	classAttributes: ['class', 'className', 'ngClass', 'class:list'],
	classFunctions: ['cn', 'cva', 'cx', 'clsx', 'twMerge', 'twJoin'],
	experimental: {classRegex: [], configFile: 'src/styles.css'},
	lint: {
		cssConflict: 'warning',
		deprecatedAtRule: 'warning',
		invalidApply: 'error',
		invalidConfigPath: 'error',
		invalidScreen: 'error',
		invalidTailwindDirective: 'error',
		invalidVariant: 'error',
		recommendedVariantOrder: 'warning',
		suggestCanonicalClasses: 'warning',
		usedBlocklistedClass: 'warning',
	},
	rootFontSize: 16,
	validate: true,
}

function printUsage(): void {
	console.log('Usage: bun run lint:tailwind [paths...] [--include-generated]')
	console.log('')
	console.log('Defaults to src/. Skips src/components/ui/** and generated route files.')
}

function toPosix(path: string): string {
	return path.split(sep).join('/')
}

function isGenerated(path: string): boolean {
	const normalized = toPosix(path)

	return normalized === 'src/components/ui' || normalized.startsWith('src/components/ui/')
}

function isSupportedFile(path: string): boolean {
	return supportedExtensions.has(extname(path))
}

function languageIdFor(path: string): string {
	const extension = extname(path)

	switch (extension) {
		case '.css':
			return 'css'
		case '.tsx':
			return 'typescriptreact'
		default:
			return 'typescript'
	}
}

function resolveServerPath(): string {
	const override = process.env['TAILWIND_LANGUAGE_SERVER']

	if (override !== undefined) return override

	const require = createRequire(import.meta.url)
	const packageJsonPath = require.resolve('@tailwindcss/language-server/package.json')

	return join(dirname(packageJsonPath), 'bin', 'tailwindcss-language-server')
}

async function collectFiles(
	entry: string,
	includeGenerated: boolean,
	files: string[],
): Promise<void> {
	const absolute = resolvePath(root, entry)
	const info = await statPath(absolute)

	if (info.isFile()) {
		const file = toPosix(relative(root, absolute))

		if (isSupportedFile(file) && (includeGenerated || !isGenerated(file))) {
			files.push(file)
		}

		return
	}

	if (!info.isDirectory()) return

	const entries = await readdir(absolute, {withFileTypes: true})
	const pendingDirectories: Array<Promise<void>> = []

	for (const dirent of entries) {
		if (dirent.isDirectory()) {
			if (ignoredDirectories.has(dirent.name)) continue

			const child = join(absolute, dirent.name)

			if (!includeGenerated && isGenerated(relative(root, child))) continue

			pendingDirectories.push(collectFiles(child, includeGenerated, files))

			continue
		}

		if (!dirent.isFile()) continue

		if (ignoredFiles.has(dirent.name) || dirent.name.endsWith('.gen.ts')) continue

		const file = toPosix(relative(root, join(absolute, dirent.name)))

		if (isSupportedFile(file) && (includeGenerated || !isGenerated(file))) {
			files.push(file)
		}
	}

	await Promise.all(pendingDirectories)
}

async function waitFor(signal: Promise<void>, milliseconds: number): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined

	const timeout = new Promise<boolean>((resolve) => {
		timer = setTimeout(() => resolve(false), milliseconds)
	})

	const completed = signal.then(() => true)
	const result = await Promise.race([completed, timeout])

	if (timer !== undefined) clearTimeout(timer)

	return result
}

async function lintFiles(files: string[]): Promise<LintRow[]> {
	const child = spawn(process.execPath, [resolveServerPath(), '--stdio'], {
		stdio: ['pipe', 'pipe', 'inherit'],
	})

	let buffer = Buffer.alloc(0)
	let nextId = 1
	let markProjectReady: (() => void) | null = null
	let markDiagnosticsSettled: (() => void) | null = null
	let documentsOpened = false
	let diagnosticsRequested = false
	let settleTimer: ReturnType<typeof setTimeout> | undefined
	const pending = new Map<number, (message: ServerMessage) => void>()
	const diagnostics = new Map<string, TailwindDiagnostic[]>()
	const openedUris = new Set<string>()

	const projectReady = new Promise<void>((resolve) => {
		markProjectReady = resolve
	})

	const diagnosticsSettled = new Promise<void>((resolve) => {
		markDiagnosticsSettled = resolve
	})

	function send(message: JsonRpcMessage): void {
		const body = JSON.stringify(message)

		child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`)
	}

	function request(method: string, params: JsonValue): Promise<ServerMessage> {
		const id = nextId

		nextId += 1

		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				pending.delete(id)
				resolve({jsonrpc: '2.0', error: {message: `timed out waiting for ${method}`}})
			}, 15000)

			pending.set(id, (message) => {
				clearTimeout(timer)
				resolve(message)
			})
			send({jsonrpc: '2.0', id, method, params})
		})
	}

	function checkSettled(): void {
		if (!diagnosticsRequested || !documentsOpened || openedUris.size === 0) return

		if (settleTimer !== undefined) clearTimeout(settleTimer)

		settleTimer = setTimeout(() => {
			markDiagnosticsSettled?.()
			markDiagnosticsSettled = null
		}, 3000)
	}

	function respondToServer(message: ServerMessage): void {
		const id = message.id

		if (id === undefined) return

		if (message.method === 'workspace/configuration') {
			const items = message.params?.items ?? []
			const settings: JsonValue[] = []

			for (const item of items) {
				settings.push(item.section === 'tailwindCSS' ? tailwindConfig : {})
			}

			send({jsonrpc: '2.0', id, result: settings})

			return
		}

		send({jsonrpc: '2.0', id, result: null})
	}

	function handleMessage(message: ServerMessage): void {
		if (message.id !== undefined && message.method !== undefined) {
			respondToServer(message)

			return
		}

		if (message.id !== undefined) {
			const resolve = pending.get(message.id)

			if (resolve !== undefined) {
				pending.delete(message.id)
				resolve(message)
			}

			return
		}

		if (message.method === '@/tailwindCSS/projectInitialized') {
			markProjectReady?.()

			return
		}

		if (message.method === 'textDocument/publishDiagnostics') {
			const uri = message.params?.uri
			const entries = message.params?.diagnostics

			if (uri === undefined || entries === undefined) return

			diagnostics.set(uri, entries)
			checkSettled()
		}
	}

	function consumeBuffer(): void {
		for (;;) {
			const headerEnd = buffer.indexOf('\r\n\r\n')

			if (headerEnd === -1) return

			const header = buffer.subarray(0, headerEnd).toString()
			const match = /Content-Length: (\d+)/i.exec(header)

			if (match === null) {
				buffer = buffer.subarray(headerEnd + 4)

				continue
			}

			const length = Number(match[1])
			const bodyStart = headerEnd + 4

			if (buffer.length < bodyStart + length) return

			const body = buffer.subarray(bodyStart, bodyStart + length).toString()

			buffer = buffer.subarray(bodyStart + length)
			// SAFETY: LSP frames are JSON-RPC; fields are read defensively at each use.
			handleMessage(JSON.parse(body) as ServerMessage)
		}
	}

	async function openDocument(file: string): Promise<void> {
		const uri = pathToFileURL(join(root, file)).href
		const text = await readFile(join(root, file), 'utf8')

		openedUris.add(uri)
		send({
			jsonrpc: '2.0',
			method: 'textDocument/didOpen',
			params: {
				textDocument: {uri, languageId: languageIdFor(file), version: 1, text},
			},
		})
	}

	child.on('error', (error) => {
		console.error(`tailwindlint: failed to start language server: ${error.message}`)
		process.exitCode = 1
	})

	child.stdout.on('data', (chunk: Buffer) => {
		buffer = Buffer.concat([buffer, chunk])
		consumeBuffer()
	})

	try {
		const initialized = await request('initialize', {
			processId: null,
			rootUri: pathToFileURL(root).href,
			rootPath: root,
			capabilities: {
				workspace: {
					configuration: true,
					workspaceFolders: true,
					didChangeWatchedFiles: {dynamicRegistration: true},
				},
				textDocument: {publishDiagnostics: {}},
			},
			initializationOptions: {},
			workspaceFolders: [{uri: pathToFileURL(root).href, name: 'workspace'}],
		})

		if (initialized.error !== undefined) {
			throw new Error(initialized.error.message)
		}

		send({jsonrpc: '2.0', method: 'initialized', params: {}})
		await openDocument('src/styles.css')

		const documents: string[] = []

		for (const file of files) {
			if (file === 'src/styles.css') continue

			documents.push(file)
		}

		await Promise.all(documents.map((file) => openDocument(file)))

		documentsOpened = true

		if (!(await waitFor(projectReady, 30000))) {
			throw new Error('Tailwind project did not initialize (is src/styles.css present?)')
		}

		/**
		 * The server only publishes diagnostics when a document changes. Open
		 * happens before the project is ready, so replay each document as a
		 * change once initialization finishes.
		 */
		await new Promise((resolve) => setTimeout(resolve, 1000))
		await Promise.all(
			files.map(async (file) => {
				const uri = pathToFileURL(join(root, file)).href
				const text = await readFile(join(root, file), 'utf8')

				send({
					jsonrpc: '2.0',
					method: 'textDocument/didChange',
					params: {
						textDocument: {uri, version: 2},
						contentChanges: [{text}],
					},
				})
			}),
		)

		diagnosticsRequested = true
		checkSettled()

		if (!(await waitFor(diagnosticsSettled, 30000))) {
			throw new Error('timed out waiting for diagnostics')
		}

		const rows: LintRow[] = []

		for (const file of files) {
			const entries = diagnostics.get(pathToFileURL(join(root, file)).href) ?? []

			for (const entry of entries) {
				if (entry.source !== 'tailwindcss') continue

				rows.push({
					file,
					line: entry.range.start.line + 1,
					character: entry.range.start.character + 1,
					message: entry.message,
					code: entry.code === undefined ? 'tailwindcss' : String(entry.code),
				})
			}
		}

		rows.sort(
			(left, right) =>
				left.file.localeCompare(right.file) ||
				left.line - right.line ||
				left.character - right.character,
		)

		return rows
	} finally {
		if (settleTimer !== undefined) clearTimeout(settleTimer)

		child.kill()
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2)
	const includeGenerated = args.includes('--include-generated')
	const wantsHelp = args.includes('--help') || args.includes('-h')
	const paths: string[] = []
	const files: string[] = []

	if (wantsHelp) {
		printUsage()

		return
	}

	for (const arg of args) {
		if (!arg.startsWith('-')) paths.push(arg)
	}

	if (paths.length === 0) paths.push('src')

	await Promise.all(paths.map((path) => collectFiles(path, includeGenerated, files)))

	const uniqueFiles = [...new Set(files)]

	if (uniqueFiles.length === 0) {
		console.error('tailwindlint: no matching files')

		process.exitCode = 2

		return
	}

	const rows = await lintFiles(uniqueFiles)

	for (const row of rows) {
		console.log(`${row.file}:${row.line}:${row.character}  ${row.message}  [${row.code}]`)
	}

	if (rows.length === 0) {
		console.log(`tailwindlint: no problems in ${uniqueFiles.length} file(s)`)

		return
	}

	console.log(`tailwindlint: ${rows.length} problem(s) in ${uniqueFiles.length} file(s)`)

	process.exitCode = 1
}

main().catch((error: Error) => {
	console.error(`tailwindlint: ${error.message}`)

	process.exitCode = 1
})

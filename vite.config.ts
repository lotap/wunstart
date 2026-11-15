import {execFileSync} from 'node:child_process'
import path from 'node:path'

import {cloudflare} from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import type {Plugin, PluginOption, ViteDevServer} from 'vite'
import {defineConfig} from 'vite'

import {parsePort} from './tools/helpers/dev-ports.ts'

/** Agent servers exit after this long without an HTTP request or file change. */
const AGENT_DEV_IDLE_DEFAULT_MS = 15 * 60 * 1000

/** How long a wedged close gets before the idle plugin forces the process out. */
const AGENT_DEV_FORCE_EXIT_MS = 5000

/**
 * Production builds generate a second route tree without dev-only routes. The
 * committed tree stays dev-complete; the router import is redirected only for
 * production builds.
 */
const PRODUCTION_ROUTE_TREE = '../.tanstack/routeTree.prod.gen.ts'

const PRODUCTION_ROUTE_TREE_PATH = path.resolve(
	import.meta.dirname,
	'.tanstack/routeTree.prod.gen.ts',
)

const DEV_ROUTE_TREE_IMPORT = './routeTree.gen.ts'
const ROUTER_PATH = path.resolve(import.meta.dirname, 'src/router.tsx')

/**
 * Idle window from `AGENT_DEV_IDLE_MS`; invalid or non-positive values fall
 * back to the default. Read once per server process.
 */
function agentIdleMs(): number {
	const raw: string | undefined = process.env['AGENT_DEV_IDLE_MS']

	if (raw === undefined || raw.trim() === '') {
		return AGENT_DEV_IDLE_DEFAULT_MS
	}

	const interval: number = Number(raw)

	return Number.isFinite(interval) && interval > 0 ? interval : AGENT_DEV_IDLE_DEFAULT_MS
}

/**
 * Last-resort cleanup for the idle path: a wedged close must not leave a
 * workerd child reparented to PID 1. Only this server's descendants are
 * touched, after close() had its chance or the backstop fired.
 */
function killChildProcesses(): void {
	const collect = (parent: number): Array<number> => {
		let out: string

		try {
			out = execFileSync('pgrep', ['-P', String(parent)], {encoding: 'utf8'})
		} catch {
			return []
		}

		const descendants: Array<number> = []

		for (const line of out.split('\n')) {
			const pid = Number(line.trim())

			if (!Number.isInteger(pid) || pid <= 0) continue

			descendants.push(pid, ...collect(pid))
		}

		return descendants
	}

	// oxlint-disable-next-line unicorn/no-array-reverse -- ES2023 toReversed is outside this project's lib target
	for (const pid of collect(process.pid).reverse()) {
		try {
			process.kill(pid, 'SIGKILL')
		} catch {
			// Already gone.
		}
	}
}

/** Exit after killing this server's descendants; close() may never resolve. */
function exitAfterChildCleanup(): never {
	killChildProcesses()
	process.exit(0)
}

/**
 * Agent-only idle shutdown. Requests through the dev middleware and file
 * watcher events prove work is happening; HMR heartbeats and TCP probes do
 * not, so an idle observer never keeps a server alive. The timer lives in
 * this process only — no registry outlives the server.
 */
function agentIdlePlugin(): Plugin {
	const idleMs: number = agentIdleMs()
	let server: ViteDevServer | undefined
	let timer: ReturnType<typeof setTimeout> | undefined

	const clear = (): void => {
		if (timer !== undefined) {
			clearTimeout(timer)
			timer = undefined
		}
	}

	const shutdown = (): void => {
		timer = undefined
		console.error(`agent dev server idle for ${idleMs}ms — shutting down`)

		const running: ViteDevServer | undefined = server

		if (running === undefined) {
			killChildProcesses()
			process.exit(0)
		}

		// If close hangs on a child process, do not leave an orphan server.
		const backstop = setTimeout(() => {
			console.error('agent dev server close timed out — exiting')
			killChildProcesses()
			process.exit(0)
		}, AGENT_DEV_FORCE_EXIT_MS)

		backstop.unref()

		void running.close().then(exitAfterChildCleanup, exitAfterChildCleanup)
	}

	const reset = (): void => {
		clear()
		timer = setTimeout(shutdown, idleMs)
	}

	return {
		name: 'wunstart-agent-idle',
		configureServer(devServer) {
			server = devServer
			devServer.middlewares.use((_req, _res, next) => {
				reset()
				next()
			})
			devServer.watcher.on('all', reset)
			reset()
		},
		closeServer() {
			// Vite restarts close the old server before configureServer runs
			// again; a stale timer would shut down the replacement.
			clear()
			server = undefined
		},
	}
}

type ServeTarget = {agent: boolean; port: number}

/**
 * Port by role: agents read AGENT_DEV_PORT (branch-hashed or --fresh),
 * humans read DEV_PORT (fixed default). Both fail early on unset/garbage
 * instead of silently colliding on :3000.
 */
function serveTarget(): ServeTarget {
	const agent: boolean = process.env['DEV_ROLE'] === 'agent'
	const name: string = agent ? 'AGENT_DEV_PORT' : 'DEV_PORT'
	const raw: string | undefined = process.env[name]

	if (raw === undefined || raw === '') {
		throw new Error(
			`${name} is not set — run branch-env to claim this worktree's ports` +
				(agent ? ' (or start with agent-dev)' : ''),
		)
	}

	const port: number | null = parsePort(raw)

	if (port === null) {
		throw new Error(`${name}=${JSON.stringify(raw)} is not a valid port — re-run branch-env`)
	}

	return {agent, port}
}

/**
 * Redirect the router's dev route tree import to the production tree generated
 * without dev-only routes. Vite resolves this before the normal file lookup.
 */
function productionRouteTreePlugin(): Plugin {
	return {
		name: 'wunstart-production-route-tree',
		enforce: 'pre',
		resolveId(source, importer) {
			if (source === DEV_ROUTE_TREE_IMPORT && importer === ROUTER_PATH) {
				return PRODUCTION_ROUTE_TREE_PATH
			}

			return undefined
		},
	}
}

/**
 * Agent servers get their own Cloudflare local state (one directory per
 * port) so fresh servers do not share Durable Object or KV state. Humans
 * keep `.wrangler/state`; the idle plugin never applies to them.
 */
function createPlugins(agentPort?: number, excludeDevRoutes = false): Array<PluginOption> {
	const persistState =
		agentPort === undefined ? undefined : {path: `.wrangler/agent-state/${agentPort}`}

	return [
		devtools(),
		cloudflare({viteEnvironment: {name: 'ssr'}, persistState}),
		tailwindcss(),
		...(agentPort === undefined ? [] : [agentIdlePlugin()]),
		tanstackStart(
			excludeDevRoutes
				? {
						router: {
							generatedRouteTree: PRODUCTION_ROUTE_TREE,
							routeFileIgnorePattern: '^_dev$',
						},
					}
				: undefined,
		),
		react(),
		babel({
			presets: [reactCompilerPreset()],
		}),
	]
}

function base(plugins: Array<PluginOption>, excludeDevRoutes = false) {
	return {
		resolve: {tsconfigPaths: true},
		assetsInclude: ['**/*.wasm'],
		envPrefix: ['VITE_', 'MAILPIT_URL'],
		plugins: excludeDevRoutes ? [productionRouteTreePlugin(), ...plugins] : plugins,
	}
}

const config = defineConfig(({command, mode}) => {
	const excludeDevRoutes = command === 'build' && mode !== 'development'

	// The port only matters for the dev server and preview; builds ignore it.
	if (command !== 'serve') return base(createPlugins(undefined, excludeDevRoutes), excludeDevRoutes)

	const {agent, port} = serveTarget()

	return {
		...base(createPlugins(agent ? port : undefined, excludeDevRoutes), excludeDevRoutes),
		server: {watch: {ignored: ['**/.tmp/**']}, port, strictPort: true},
		preview: {port, strictPort: true},
	}
})

export default config

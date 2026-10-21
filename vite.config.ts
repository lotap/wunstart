import {cloudflare} from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

/**
 * Per-worktree dev port, claimed by `bun run branch-env` (see tools/setup/branch-env):
 * trunk keeps 3000, branches hash into 3100-3199 (clear of :3001 email dev).
 * Always written to `.env.local`, which the `dev` script loads — unset or
 * garbage fails early instead of silently colliding on :3000.
 */
const plugins = [
	devtools(),
	cloudflare({viteEnvironment: {name: 'ssr'}}),
	tailwindcss(),
	tanstackStart(),
	react(),
	babel({
		presets: [reactCompilerPreset()],
	}),
]

const base = {
	resolve: {tsconfigPaths: true},
	assetsInclude: ['**/*.wasm'],
	plugins,
}

function devPort(): number {
	const raw = process.env['DEV_PORT']
	if (raw === undefined || raw === '') {
		throw new Error('DEV_PORT is not set — run `bun run branch-env` to claim this worktree dev port')
	}
	const port = Number(raw)
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		throw new Error(`DEV_PORT=${JSON.stringify(raw)} is not a valid port — re-run \`bun run branch-env\``)
	}
	return port
}

const config = defineConfig(({command}) => {
	// The port only matters for the dev server and preview; builds ignore it.
	if (command !== 'serve') return base
	const port = devPort()
	return {
		...base,
		server: {watch: {ignored: ['**/.tmp/**']}, port, strictPort: true},
		preview: {port, strictPort: true},
	}
})

export default config

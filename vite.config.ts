import {cloudflare} from '@cloudflare/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import {devtools} from '@tanstack/devtools-vite'
import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import react, {reactCompilerPreset} from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

const config = defineConfig({
	resolve: {tsconfigPaths: true},
	assetsInclude: ['**/*.wasm'],
	plugins: [
		devtools(),
		cloudflare({viteEnvironment: {name: 'ssr'}}),
		tailwindcss(),
		tanstackStart(),
		react(),
		babel({
			presets: [reactCompilerPreset()],
		}),
	],
})

export default config

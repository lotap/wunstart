import {defineConfig} from 'vitest/config'

// Linter-only runner. The root vite.config.ts loads the Cloudflare plugin,
// which rejects vitest's ssr.resolve.external list at startup (pre-existing,
// same on trunk) — so rule tests run here instead, without that plugin.
export default defineConfig({
	test: {
		globals: true,
		include: ['tools/linters/**/*.test.ts'],
	},
})

import {eslintCompatPlugin} from '@oxlint/plugins'

import {emailLayerAllowlistRule} from './rules/email-layer-allowlist.ts'
import {noSingleSessionRevokeRule} from './rules/no-single-session-revoke.ts'
import {noStaticWorkersImportInMiddlewareRule} from './rules/no-static-workers-import-in-middleware.ts'

/**
 * Wunstart app-wiring conformity rules (routes, middleware, cookies, runtime).
 * New rules: cover import, re-export (`export … from`), and dynamic `import()` — ImportDeclaration-only misses two carriers.
 */
const wunstartPlugin = eslintCompatPlugin({
	meta: {name: 'wunstart'},
	rules: {
		'no-static-workers-import-in-middleware': noStaticWorkersImportInMiddlewareRule,
		'no-single-session-revoke': noSingleSessionRevokeRule,
		'email-layer-allowlist': emailLayerAllowlistRule,
	},
})

export default wunstartPlugin

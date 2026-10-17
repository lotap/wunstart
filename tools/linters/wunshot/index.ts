import {eslintCompatPlugin} from '@oxlint/plugins'

import {noFailedCredentialInDenialRule} from './rules/no-failed-credential-in-denial.ts'
import {noPgTableDirectRule} from './rules/no-pgtable-direct.ts'
import {noZodValibotRule} from './rules/no-zod-valibot.ts'

/**
 * Portable wunshot DB-module conformity rules.
 * Module-source rules must cover import, re-export (`export … from`), and dynamic `import()`
 * — ImportDeclaration-only misses two carriers. Call-shape rules (`no-failed-credential-in-denial`)
 * have no import carriers to cover by nature.
 */
const wunshotPlugin = eslintCompatPlugin({
	meta: {name: 'wunshot'},
	rules: {
		'no-pgtable-direct': noPgTableDirectRule,
		'no-zod-valibot': noZodValibotRule,
		'no-failed-credential-in-denial': noFailedCredentialInDenialRule,
	},
})

export default wunshotPlugin

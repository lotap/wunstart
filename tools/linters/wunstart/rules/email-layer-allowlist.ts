import {defineRule} from '@oxlint/plugins'

const EMAIL_SOURCES = new Set(['#/email/layer.ts', '#/email/service.ts'])

function isEmailPath(path: string): boolean {
	const normalized = path.replaceAll('\\', '/')
	return (
		normalized.includes('src/email/') ||
		normalized.includes('src/db/ops/') ||
		normalized.includes('src/server-fns/') ||
		normalized.includes('src/middleware/')
	)
}

/**
 * Email-sending capability is constrained to one code path (abuse-surface minimization).
 * emailLayer is provided only where email actually sends (ops that send + the server
 * fns / middleware that provide it); new send sites need an explicit layer pass
 * visible in review.
 */
export const emailLayerAllowlistRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow email layer/service imports outside email, ops, server-fns, and middleware paths.',
		},
		messages: {
			emailLayerOutsideAllowlist:
				'Do not import `{{source}}` here. Email-sending capability is limited to `src/email/`, `src/db/ops/`, `src/server-fns/`, and `src/middleware/` so new send sites stay visible in review.',
		},
	},
	create(context) {
		if (isEmailPath(context.filename)) return {}
		return {
			ImportDeclaration(node) {
				const source: string = node.source.value
				if (!EMAIL_SOURCES.has(source)) return
				context.report({
					node: node.source,
					messageId: 'emailLayerOutsideAllowlist',
					data: {source},
				})
			},
		}
	},
})

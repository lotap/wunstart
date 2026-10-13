import {defineRule} from '@oxlint/plugins'

/**
 * Any `#/email/` subpath: layer + service + templates + transports + format
 * helpers. Email-sending capability must not leak into routes/components; only
 * the approved code path (ops that send + the server fns / middleware that
 * provide the layer) may touch it. The `/email/` segment match also catches
 * relative traversals (`../../email/…`); `#/`-only is prose, not lint.
 */
function isEmailSource(source: string): boolean {
	return source === '#/email' || source.includes('/email/')
}

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
				if (!isEmailSource(source)) return
				context.report({
					node: node.source,
					messageId: 'emailLayerOutsideAllowlist',
					data: {source},
				})
			},
			ExportNamedDeclaration(node) {
				if (node.exportKind === 'type' || !node.source) return
				const source: string = node.source.value
				if (!isEmailSource(source)) return
				context.report({
					node: node.source,
					messageId: 'emailLayerOutsideAllowlist',
					data: {source},
				})
			},
			ExportAllDeclaration(node) {
				if (node.exportKind === 'type') return
				const source: string = node.source.value
				if (!isEmailSource(source)) return
				context.report({
					node: node.source,
					messageId: 'emailLayerOutsideAllowlist',
					data: {source},
				})
			},
			ImportExpression(node) {
				const source = node.source
				if (source.type !== 'Literal') return
				if (source.value === null) return
				const text = `${source.value}`
				if (!isEmailSource(text)) return
				context.report({
					node: source,
					messageId: 'emailLayerOutsideAllowlist',
					data: {source: text},
				})
			},
		}
	},
})

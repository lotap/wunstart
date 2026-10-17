import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

/**
 * Any `#/email/` subpath: layer + service + templates + transports + format
 * helpers. Email-sending capability must not leak into routes/components; only
 * the approved code path (ops that send + the server fns / middleware that
 * provide the layer) may touch it. The `/email/` segment match also catches
 * relative traversals (`../../email/…`); `#/`-only is prose, not lint.
 */
function isEmailSource(source: string): boolean {
	return source === '#/email' || source.split('/').includes('email')
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

/** True when every specifier is an inline `type` import (erased at compile, carries no capability). */
function isTypeOnlyImport(node: ESTree.ImportDeclaration): boolean {
	if (node.importKind === 'type') return true
	return (
		node.specifiers.length > 0 &&
		node.specifiers.every((s) => s.type === 'ImportSpecifier' && s.importKind === 'type')
	)
}

/** True when every specifier is an inline `type` re-export (erased at compile, carries no capability). */
function isTypeOnlyExport(node: ESTree.ExportNamedDeclaration): boolean {
	if (node.exportKind === 'type') return true
	return node.specifiers.length > 0 && node.specifiers.every((s) => s.exportKind === 'type')
}

/**
 * Email-sending capability is constrained to one code path (abuse-surface minimization).
 * emailLayer is provided only where email actually sends (ops that send + the server
 * fns / middleware that provide it); new send sites need an explicit layer pass
 * visible in review. Op-side invariant owned by the wunshot auth contract
 * (`wunshot/references/auth.md`).
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
				if (isTypeOnlyImport(node)) return
				const source: string = node.source.value
				if (!isEmailSource(source)) return
				context.report({
					node: node.source,
					messageId: 'emailLayerOutsideAllowlist',
					data: {source},
				})
			},
			ExportNamedDeclaration(node) {
				if (!node.source || isTypeOnlyExport(node)) return
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

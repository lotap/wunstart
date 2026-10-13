import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

function isMiddlewareFile(filename: string): boolean {
	return filename.replaceAll('\\', '/').includes('src/middleware/')
}

/** True when every specifier is an inline `type` import (erased at compile, always safe). */
function isTypeOnlyImport(node: ESTree.ImportDeclaration): boolean {
	if (node.importKind === 'type') return true
	return (
		node.specifiers.length > 0 &&
		node.specifiers.every((s) => s.type === 'ImportSpecifier' && s.importKind === 'type')
	)
}

/**
 * Request-bound op modules, by their basename without extension. Static VALUE
 * imports of these inside src/middleware/ recreate the flattenMiddlewares crash
 * (middleware evaluates to undefined during TanStack's early graph build).
 * Static layers (dbLayer, authLayer), error classes, signAnon, and `import type`
 * of the ops below are proven safe and stay static.
 */
const REQUEST_BOUND_OPS = new Set(['refresh', 'verify-access', 'verify-anon'])

function isRequestBoundOp(source: string): boolean {
	if (!source.includes('db/ops/')) return false
	const basename = source.split('/').pop() ?? source
	return REQUEST_BOUND_OPS.has(basename.replace(/\.tsx?$/u, ''))
}

function isDangerSource(source: string): boolean {
	return source === 'cloudflare:workers' || isRequestBoundOp(source)
}

/**
 * Middleware modules must not statically import request-bound op modules.
 * Use await import() inside .server(); import type at top is fine (erased).
 * If a new op transitively needs the hashing stub / service bindings, add its
 * basename to REQUEST_BOUND_OPS and import it dynamically.
 */
export const noStaticWorkersImportInMiddlewareRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow static imports of request-bound ops and cloudflare:workers in middleware; use dynamic import() inside .server().',
		},
		messages: {
			staticWorkersImport:
				'Do not statically import `{{source}}` in middleware. Use `await import()` inside the `.server()` handler so the middleware object stays defined during graph build (use `import type` for types).',
		},
	},
	create(context) {
		if (!isMiddlewareFile(context.filename)) return {}
		return {
			ImportDeclaration(node) {
				if (isTypeOnlyImport(node)) return
				const source: string = node.source.value
				if (isDangerSource(source)) {
					context.report({node: node.source, messageId: 'staticWorkersImport', data: {source}})
				}
			},
			ExportNamedDeclaration(node) {
				if (node.exportKind === 'type' || !node.source) return
				const source: string = node.source.value
				if (isDangerSource(source)) {
					context.report({node: node.source, messageId: 'staticWorkersImport', data: {source}})
				}
			},
			ExportAllDeclaration(node) {
				if (node.exportKind === 'type') return
				const source: string = node.source.value
				if (isDangerSource(source)) {
					context.report({node: node.source, messageId: 'staticWorkersImport', data: {source}})
				}
			},
		}
	},
})

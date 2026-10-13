import {defineRule} from '@oxlint/plugins'

function isMiddlewareFile(filename: string): boolean {
	return filename.replaceAll('\\', '/').includes('src/middleware/')
}

type ImportSpecifierLike = {type: string; importKind?: string}

/** True when every specifier is an inline `type` import (erased at compile, always safe). */
function isTypeOnlyImport(specifiers: ImportSpecifierLike[]): boolean {
	return (
		specifiers.length > 0 &&
		specifiers.every((s) => s.type !== 'ImportSpecifier' || s.importKind === 'type')
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
	const basename = source.split('/').pop() ?? source
	return REQUEST_BOUND_OPS.has(basename.replace(/\.tsx?$/u, ''))
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
				const source: string = node.source.value
				if (node.importKind === 'type') return
				if (isTypeOnlyImport(node.specifiers as unknown as ImportSpecifierLike[])) return
				if (source === 'cloudflare:workers' || isRequestBoundOp(source)) {
					context.report({node: node.source, messageId: 'staticWorkersImport', data: {source}})
				}
			},
		}
	},
})

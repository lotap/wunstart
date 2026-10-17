import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

/** True for `(await import('drizzle-orm/pg-core'))` used inline as a member-call object. */
function isInlinePgCoreImport(object: ESTree.MemberExpression['object']): boolean {
	const awaited = object.type === 'AwaitExpression' ? object.argument : object
	if (awaited.type !== 'ImportExpression') return false
	const source = awaited.source
	return source.type === 'Literal' && source.value === 'drizzle-orm/pg-core'
}

/** Never use pgTable directly; use createActive/Archive/LogTable factories (wunshot skill). */
export const noPgTableDirectRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow direct pgTable use; table definitions must go through the wunshot table factories.',
		},
		messages: {
			pgTableDirect:
				'Do not use `pgTable` directly. Use `createActiveTable` / `createArchiveTable` / `createActiveLogTable` / `createArchiveLogTable` from `db/helpers/tables.ts` so active/archive pairs stay consistent.',
		},
	},
	create(context) {
		// Local names bound to the pg-core module object, via a namespace/default
		// static import or a dynamic import. Only `.pgTable()` on these is drizzle's.
		const drizzleModules = new Set<string>()
		return {
			ImportDeclaration(node) {
				if (node.source.value !== 'drizzle-orm/pg-core') return
				for (const specifier of node.specifiers) {
					if (specifier.type !== 'ImportSpecifier') {
						if (specifier.local.type === 'Identifier') drizzleModules.add(specifier.local.name)
						continue
					}
					const imported =
						specifier.imported.type === 'Identifier'
							? specifier.imported.name
							: specifier.imported.value
					if (imported === 'pgTable') {
						context.report({node: specifier, messageId: 'pgTableDirect'})
					}
				}
			},
			// Re-exporting pgTable (or the whole module) hands others the bypass.
			// No ImportExpression visitor by design: bare `import('drizzle-orm/pg-core')`
			// is legitimate (snakeCase et al. load this way); use is caught at the call site.
			// The declarator below only records the binding name for the member check.
			ExportNamedDeclaration(node) {
				if (!node.source || node.source.value !== 'drizzle-orm/pg-core') return
				for (const spec of node.specifiers) {
					// String-literal locals (`export {'pgTable' as x}`) bypass this; review is the backstop.
					if (spec.local.type === 'Identifier' && spec.local.name === 'pgTable') {
						context.report({node: spec, messageId: 'pgTableDirect'})
					}
				}
			},
			ExportAllDeclaration(node) {
				if (node.source.value !== 'drizzle-orm/pg-core') return
				context.report({node: node.source, messageId: 'pgTableDirect'})
			},
			// `const pg = await import('drizzle-orm/pg-core')` binds the module object.
			VariableDeclarator(node) {
				const init = node.init
				if (!init) return
				const awaited = init.type === 'AwaitExpression' ? init.argument : init
				if (!awaited || awaited.type !== 'ImportExpression') return
				const source = awaited.source
				if (source.type !== 'Literal' || source.value !== 'drizzle-orm/pg-core') return
				if (node.id.type === 'Identifier') drizzleModules.add(node.id.name)
			},
			// `(await import('drizzle-orm/pg-core')).pgTable(…)` — inline dynamic import
			// as the call object, with no declarator binding it.
			CallExpression(node) {
				if (node.callee.type === 'Identifier' && node.callee.name === 'pgTable') {
					context.report({node: node.callee, messageId: 'pgTableDirect'})
				}
				// Member calls only flag on a known pg-core module binding, so an
				// unrelated helper's own `.pgTable()` method is left alone.
				if (
					node.callee.type === 'MemberExpression' &&
					node.callee.property.type === 'Identifier' &&
					node.callee.property.name === 'pgTable' &&
					((node.callee.object.type === 'Identifier' &&
						drizzleModules.has(node.callee.object.name)) ||
						isInlinePgCoreImport(node.callee.object))
				) {
					context.report({node: node.callee.property, messageId: 'pgTableDirect'})
				}
			},
		}
	},
})

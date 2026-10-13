import {defineRule} from '@oxlint/plugins'

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
		return {
			ImportDeclaration(node) {
				if (node.source.value !== 'drizzle-orm/pg-core') return
				for (const specifier of node.specifiers) {
					if (specifier.type !== 'ImportSpecifier') continue
					const imported =
						specifier.imported.type === 'Identifier'
							? specifier.imported.name
							: specifier.imported.value
					if (imported === 'pgTable') {
						context.report({node: specifier, messageId: 'pgTableDirect'})
					}
				}
			},
			CallExpression(node) {
				if (node.callee.type === 'Identifier' && node.callee.name === 'pgTable') {
					context.report({node: node.callee, messageId: 'pgTableDirect'})
				}
				if (
					node.callee.type === 'MemberExpression' &&
					node.callee.property.type === 'Identifier' &&
					node.callee.property.name === 'pgTable'
				) {
					context.report({node: node.callee.property, messageId: 'pgTableDirect'})
				}
			},
		}
	},
})

import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

/**
 * No forwarding re-exports in the portable DB module. Every symbol has one
 * owning module; consumers import it there. Moving a symbol updates its
 * consumers instead of leaving a compatibility export that no one requires.
 */
export const noReexportRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow forwarding re-exports; every symbol has one owning module.',
		},
		messages: {
			forwardingReexport:
				'Do not forward a symbol through this module. Import it from its owning module instead, and update consumers when it moves.',
		},
	},
	create(context) {
		const importedBindings = new Set<string>()

		const report = (node: ESTree.Node) => context.report({node, messageId: 'forwardingReexport'})

		return {
			// Collect imports before visiting exports so a re-export that appears
			// before its import is still seen as forwarding.
			Program(node) {
				for (const statement of node.body) {
					if (statement.type !== 'ImportDeclaration') continue

					for (const specifier of statement.specifiers) {
						importedBindings.add(specifier.local.name)
					}
				}
			},
			ExportNamedDeclaration(node) {
				if (node.source) {
					report(node)

					return
				}

				if (
					node.specifiers.some(
						(specifier) =>
							specifier.local.type === 'Identifier' && importedBindings.has(specifier.local.name),
					)
				)
					report(node)
			},
			ExportAllDeclaration(node) {
				report(node)
			},
			ExportDefaultDeclaration(node) {
				if (node.declaration.type === 'Identifier' && importedBindings.has(node.declaration.name))
					report(node.declaration)
			},
		}
	},
})

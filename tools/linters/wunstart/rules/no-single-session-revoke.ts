import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

const ALLOWED_NAMES = new Set(['revokeForReuse'])
const REVOKE = /revoke/i
const SESSION = /session/i
const WHOLE_FAMILY = /all/i
const REUSE = /reuse/i

function exportedName(node: ESTree.ExportNamedDeclaration): string | null {
	const declaration = node.declaration
	if (declaration?.type === 'VariableDeclaration') {
		const first = declaration.declarations[0]
		if (first?.id.type === 'Identifier') return first.id.name
		return null
	}
	if (
		(declaration?.type === 'FunctionDeclaration' ||
			declaration?.type === 'ClassDeclaration') &&
		declaration.id !== null
	) {
		return declaration.id.name
	}
	return null
}

/**
 * No user-facing single-session revocation (watcher-loop lockout; signOutAll only).
 * Server-side revokeForReuse and whole-family revokes (*All*) stay allowed.
 * Naming-convention guard only: it cannot catch evasive names (review is the backstop).
 */
export const noSingleSessionRevokeRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow user-facing single-session revoke exports; eviction tool is signOutAll.',
		},
		messages: {
			singleSessionRevoke:
				'Do not expose single-session revocation `{{name}}`. Ship the sessions list for visibility and keep `signOutAll` as the only user-facing eviction tool (server-side `revokeForReuse` and whole-family revokes stay allowed).',
		},
	},
	create(context) {
		return {
			ExportNamedDeclaration(node) {
				const name = exportedName(node)
				if (name === null || ALLOWED_NAMES.has(name)) return
				if (REUSE.test(name) || WHOLE_FAMILY.test(name)) return
				if (REVOKE.test(name) && SESSION.test(name)) {
					context.report({node, messageId: 'singleSessionRevoke', data: {name}})
				}
			},
		}
	},
})

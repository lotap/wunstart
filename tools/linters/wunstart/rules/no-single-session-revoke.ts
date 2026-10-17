import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

const ALLOWED_NAMES = new Set(['revokeForReuse', 'noSingleSessionRevokeRule'])
const REVOKE = /revoke/i
const SESSION = /session/i
const WHOLE_FAMILY = /all/i
const REUSE = /reuse/i

function declarationNames(declaration: ESTree.ExportNamedDeclaration['declaration']): string[] {
	if (declaration?.type === 'VariableDeclaration') {
		return declaration.declarations.flatMap((d) => (d.id.type === 'Identifier' ? [d.id.name] : []))
	}
	if (
		(declaration?.type === 'FunctionDeclaration' || declaration?.type === 'ClassDeclaration') &&
		declaration.id !== null
	) {
		return [declaration.id.name]
	}
	return []
}

function isViolationName(name: string): boolean {
	if (ALLOWED_NAMES.has(name)) return false
	if (REUSE.test(name) || WHOLE_FAMILY.test(name)) return false
	return REVOKE.test(name) && SESSION.test(name)
}

function specifierExportedName(spec: ESTree.ExportSpecifier): string {
	if (spec.exported.type === 'Identifier') return spec.exported.name
	// `export {x as 'revoke-session'}`: string-literal export names are rare; match literally.
	return spec.exported.value
}

/**
 * No user-facing single-session revocation (watcher-loop lockout; signOutAll only).
 * Server-side revokeForReuse and whole-family revokes (*All*) stay allowed.
 * Naming-convention guard only: it cannot catch evasive names (review is the backstop).
 * Invariant owned by the wunshot auth contract (`wunshot/references/auth.md`).
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
				'Do not expose per-session revocation of other sessions `{{name}}` (sign-out ends your own session and is fine). Ship the sessions list for visibility and keep `signOutAll` as the only user-facing eviction tool (server-side `revokeForReuse` and whole-family revokes stay allowed).',
		},
	},
	create(context) {
		return {
			ExportNamedDeclaration(node) {
				// `export const revokeSession = …` / `export function revokeSession() …`
				const name = declarationNames(node.declaration).find(isViolationName)
				if (name !== undefined) {
					context.report({node, messageId: 'singleSessionRevoke', data: {name}})
					return
				}
				// `export {revokeSession}` / `export {x as revokeSession}` (public name is what matters)
				for (const spec of node.specifiers) {
					const specName = specifierExportedName(spec)
					if (isViolationName(specName)) {
						context.report({node: spec, messageId: 'singleSessionRevoke', data: {name: specName}})
					}
				}
			},
			ExportDefaultDeclaration(node) {
				// `export default function revokeSession() …` / `export default revokeSession`
				const declaration = node.declaration
				const name =
					(declaration.type === 'FunctionDeclaration' || declaration.type === 'ClassDeclaration') &&
					declaration.id !== null
						? declaration.id.name
						: declaration.type === 'Identifier'
							? declaration.name
							: null
				if (name !== null && isViolationName(name)) {
					context.report({node, messageId: 'singleSessionRevoke', data: {name}})
				}
			},
		}
	},
})

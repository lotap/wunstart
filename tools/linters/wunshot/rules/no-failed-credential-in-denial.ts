import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

function isFailedCredentialKey(property: ESTree.ObjectProperty): boolean {
	if (property.computed) return false
	const key = property.key
	if (key.type === 'Identifier') return key.name === 'failedCredential'
	return key.type === 'Literal' && key.value === 'failedCredential'
}

/**
 * Rate-limit denials must never carry failedCredential into a persisted activity:
 * an attacker cycling IPs would extend a credential ban forever, locking the
 * legitimate owner out. Pass the email as meta: {credential} for audit only.
 * Matches the literal `rateLimitFailure` callee and literal object keys only;
 * aliased callees and pre-built/spread option objects bypass it (review is the backstop).
 */
export const noFailedCredentialInDenialRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow failedCredential in rateLimitFailure calls; denial weight must route to IP scope only.',
		},
		messages: {
			failedCredential:
				'Do not pass `failedCredential` to `rateLimitFailure`. Omit it so weight routes to IP scope; pass the email as `meta: {credential}` for audit only.',
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				const callee =
					node.callee.type === 'Identifier'
						? node.callee.name
						: node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier'
							? node.callee.property.name
							: null
				if (callee !== 'rateLimitFailure') return
				for (const argument of node.arguments) {
					if (argument.type !== 'ObjectExpression') continue
					for (const property of argument.properties) {
						if (property.type !== 'Property') continue
						if (isFailedCredentialKey(property)) {
							context.report({node: property, messageId: 'failedCredential'})
						}
					}
				}
			},
		}
	},
})

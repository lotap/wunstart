import {defineRule} from '@oxlint/plugins'

type ObjectProp = {
	type: string
	computed?: boolean
	key?: {type: string; name?: string; value?: unknown}
}

function propertyKeyName(property: ObjectProp): string | null {
	if (property.type !== 'Property' || property.computed === true) return null
	if (property.key?.type === 'Identifier') return property.key.name ?? null
	if (property.key?.type === 'Literal' && typeof property.key.value === 'string') {
		return property.key.value
	}
	return null
}

/**
 * Rate-limit denials must never carry failedCredential into a persisted activity:
 * an attacker cycling IPs would extend a credential ban forever, locking the
 * legitimate owner out. Pass the email as meta: {credential} for audit only.
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
						: node.callee.type === 'MemberExpression' &&
							  node.callee.property.type === 'Identifier'
							? node.callee.property.name
							: null
				if (callee !== 'rateLimitFailure') return
				for (const argument of node.arguments) {
					if (argument.type !== 'ObjectExpression') continue
					for (const property of argument.properties) {
						if (propertyKeyName(property as unknown as ObjectProp) === 'failedCredential') {
							context.report({node: property, messageId: 'failedCredential'})
						}
					}
				}
			},
		}
	},
})

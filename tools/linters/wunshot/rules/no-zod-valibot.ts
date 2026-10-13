import {defineRule} from '@oxlint/plugins'

const FORBIDDEN_EXACT = new Set([
	'zod',
	'valibot',
	'drizzle-zod',
	'drizzle-orm/zod',
	'drizzle-orm/valibot',
	'drizzle-valibot',
	'@hono/zod-validator',
	'@hono/valibot-validator',
])

function isForbiddenSource(source: string): boolean {
	if (FORBIDDEN_EXACT.has(source)) return true
	return (
		source.startsWith('zod/') ||
		source.startsWith('valibot/') ||
		source.startsWith('drizzle-orm/zod/') ||
		source.startsWith('drizzle-orm/valibot/')
	)
}

/** Effect Schema is canonical; zod/valibot are stale (wunshot skill). */
export const noZodValibotRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow zod/valibot imports; validation must use Effect Schema.',
		},
		messages: {
			zodValibot:
				'Do not import `{{source}}`. Validation is Effect Schema everywhere (`drizzle-orm/effect-schema` bridge); zod/valibot are stale.',
		},
	},
	create(context) {
		return {
			ImportDeclaration(node) {
				const source: string = node.source.value
				if (!isForbiddenSource(source)) return
				context.report({node: node.source, messageId: 'zodValibot', data: {source}})
			},
			ExportNamedDeclaration(node) {
				if (!node.source) return
				const source: string = node.source.value
				if (!isForbiddenSource(source)) return
				context.report({node: node.source, messageId: 'zodValibot', data: {source}})
			},
			ExportAllDeclaration(node) {
				const source: string = node.source.value
				if (!isForbiddenSource(source)) return
				context.report({node: node.source, messageId: 'zodValibot', data: {source}})
			},
			ImportExpression(node) {
				const source = node.source
				if (source.type !== 'Literal') return
				if (source.value === null) return
				const text = `${source.value}`
				if (!isForbiddenSource(text)) return
				context.report({node: source, messageId: 'zodValibot', data: {source: text}})
			},
		}
	},
})

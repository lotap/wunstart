import {defineRule} from '@oxlint/plugins'
import type {ESTree} from '@oxlint/plugins'

const TX_PARAM_NAMES = new Set(['tx', '_tx'])
const MISMATCH_TAG = 'ArchiveCountMismatchError'

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
	return (
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression'
	)
}

/** True when the function's first parameter is the caller's transaction. */
function receivesTransaction(node: FunctionNode): boolean {
	const [first] = node.params

	return first?.type === 'Identifier' && TX_PARAM_NAMES.has(first.name)
}

/** True when any enclosing function receives a transaction, so the code runs inside it. */
function insideTransaction(node: ESTree.Node): boolean {
	let current = node.parent

	while (current) {
		if (isFunctionNode(current) && receivesTransaction(current)) return true
		current = current.parent
	}

	return false
}

function isMismatchTag(argument: ESTree.Argument): boolean {
	return argument.type === 'Literal' && argument.value === MISMATCH_TAG
}

function isMismatchProperty(property: ESTree.ObjectProperty): boolean {
	if (property.computed) return false

	if (property.key.type === 'Identifier') return property.key.name === MISMATCH_TAG

	return property.key.type === 'Literal' && property.key.value === MISMATCH_TAG
}

function calleeName(callee: ESTree.Expression): string | null {
	if (callee.type === 'Identifier') return callee.name

	if (callee.type === 'MemberExpression' && !callee.computed) return callee.property.name

	return null
}

/**
 * `ArchiveCountMismatchError` means the archive's delete matched fewer rows than
 * its select found: another writer archived a row first. The transaction is
 * still healthy, so catching the error inside a transaction commits this
 * cascade's archive insert as a duplicate. Let it roll back and let the caller
 * retry with `retryTransientOrArchiveRace`; catching is only safe outside an
 * archive call that owns its transaction.
 *
 * Ownership is recognized by a function whose first parameter is `tx` or `_tx`
 * — the cascade callback or the `db.transaction(...)` body, which is how this
 * repo passes an outer transaction. A transaction bound under another name, an
 * aliased `catchTag`, and a pre-built options object bypass the rule (review is
 * the backstop).
 */
export const noCatchArchiveCountMismatchInTxRule = defineRule({
	meta: {
		type: 'problem',
		docs: {
			description:
				'Disallow catching ArchiveCountMismatchError inside a transaction body or cascade callback.',
		},
		messages: {
			archiveMismatchInTx:
				'Do not catch `ArchiveCountMismatchError` inside a transaction: the count check rolls the transaction back on purpose, and catching it commits the archive insert as a duplicate. Let it propagate; the caller retries with `retryTransientOrArchiveRace`.',
		},
	},
	create(context) {
		return {
			CallExpression(node) {
				const callee = calleeName(node.callee)

				if (callee !== 'catchTag' && callee !== 'catchTags') return

				if (!insideTransaction(node)) return

				const [argument] = node.arguments

				if (!argument) return

				if (callee === 'catchTag') {
					if (isMismatchTag(argument))
						context.report({node: argument, messageId: 'archiveMismatchInTx'})

					return
				}

				if (argument.type !== 'ObjectExpression') return

				for (const property of argument.properties) {
					if (property.type !== 'Property') continue

					if (!isMismatchProperty(property)) continue

					context.report({node: property, messageId: 'archiveMismatchInTx'})
				}
			},
		}
	},
})

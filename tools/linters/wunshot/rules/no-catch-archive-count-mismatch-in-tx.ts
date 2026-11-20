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

/** True when the property key names the transaction. */
function isTransactionKey(key: ESTree.PropertyKey): boolean {
	if (key.type === 'Identifier') return TX_PARAM_NAMES.has(key.name)

	if (key.type !== 'Literal') return false

	return TX_PARAM_NAMES.has(String(key.value))
}

/**
 * True when a parameter binds the caller's transaction, either positionally
 * (`tx`) or destructured from an options object (`{tx}`, as `runArchival`
 * takes it).
 */
function bindsTransaction(param: ESTree.ParamPattern): boolean {
	if (param.type === 'Identifier') return TX_PARAM_NAMES.has(param.name)

	if (param.type === 'AssignmentPattern') return bindsTransaction(param.left)

	if (param.type === 'ObjectPattern')
		return param.properties.some(
			(property) =>
				property.type === 'Property' && !property.computed && isTransactionKey(property.key),
		)

	return false
}

/** True when any enclosing function receives a transaction, so the code runs inside it. */
function insideTransaction(node: ESTree.Node): boolean {
	let current = node.parent

	while (current) {
		if (isFunctionNode(current) && current.params.some(bindsTransaction)) return true
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
 * Ownership is recognized by a `tx`/`_tx` parameter: positional, or destructured
 * from an options object. That covers cascade callbacks, `db.transaction(...)`
 * bodies, and the archive machinery that raises the error. A transaction bound
 * under another name or read from a variable, and an aliased `catchTag`, bypass
 * the rule (review is the backstop).
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

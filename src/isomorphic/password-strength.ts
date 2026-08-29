import {ZxcvbnFactory} from '@zxcvbn-ts/core'
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common'
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en'

/**
 * zxcvbn scores passwords 0-4 based on estimated real-world cracking resistance.
 * A score of 3+ means the password is safe from most offline attacks
 */
export const MIN_PASSWORD_SCORE = 3

const zxcvbn = new ZxcvbnFactory({
	dictionary: {
		...zxcvbnCommonPackage.dictionary,
		...zxcvbnEnPackage.dictionary,
	},
	graphs: zxcvbnCommonPackage.adjacencyGraphs,
	translations: zxcvbnEnPackage.translations,
	useLevenshteinDistance: true,
})

export function checkPasswordStrength(password: string) {
	const {score, feedback} = zxcvbn.check(password)

	return {
		score,
		isStrong: score >= MIN_PASSWORD_SCORE,
		/** Why the password is weak and how to improve it, e.g. zxcvbn's warning + suggestions */
		message: [feedback.warning, ...feedback.suggestions].filter(Boolean).join(' '),
	}
}

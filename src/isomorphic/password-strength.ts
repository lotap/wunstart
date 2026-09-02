import {ZxcvbnFactory} from '@zxcvbn-ts/core'
import type {Score, ZxcvbnResult} from '@zxcvbn-ts/core'

/**
 * zxcvbn scores passwords 0-4 based on estimated real-world cracking resistance.
 * A score of 3+ means the password is safe from most offline attacks
 */
export const MIN_PASSWORD_SCORE = 3

export type PasswordStrength = {
	score: Score
	isStrong: boolean
	/** Why the password is weak and how to improve it, e.g. zxcvbn's warning + suggestions */
	message: string
}

type Zxcvbn = InstanceType<typeof ZxcvbnFactory>

let zxcvbnPromise: Promise<Zxcvbn> | undefined

/**
 * The language dictionaries are large, so they are only fetched the first time
 * a password is actually checked instead of being bundled up front
 * https://zxcvbn-ts.github.io/zxcvbn/guide/best-practices/#lazy-loading
 */
export function loadZxcvbn() {
	zxcvbnPromise ??= (async () => {
		const [commonPackage, enPackage] = await Promise.all([
			import('@zxcvbn-ts/language-common'),
			import('@zxcvbn-ts/language-en'),
		])

		return new ZxcvbnFactory({
			dictionary: {
				...commonPackage.dictionary,
				...enPackage.dictionary,
			},
			graphs: commonPackage.adjacencyGraphs,
			translations: enPackage.translations,
			useLevenshteinDistance: true,
		})
	})().catch((error) => {
		zxcvbnPromise = undefined
		throw error
	})

	return zxcvbnPromise
}

/**
 * Checks a password against the zxcvbn dictionaries plus contextual inputs
 * (the app name is always included; pass identifiers like the user's email)
 * https://zxcvbn-ts.github.io/zxcvbn/guide/best-practices/
 */
export async function checkPasswordStrength(password: string, userInputs: Array<string> = []) {
	const zxcvbn = await loadZxcvbn()

	const {score, feedback}: ZxcvbnResult = zxcvbn.check(password, ['wunstart', ...userInputs])

	return {
		score,
		isStrong: score >= MIN_PASSWORD_SCORE,
		message:
			[feedback.warning, ...feedback.suggestions].filter(Boolean).join(' ') ||
			'That password is too weak. Try a longer or less predictable one.',
	}
}

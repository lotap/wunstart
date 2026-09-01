import type {Score} from '@zxcvbn-ts/core'
import {useEffect, useState} from 'react'

import {checkPasswordStrength} from '#/isomorphic/password-strength.ts'
import {cn} from '#/lib/utils.ts'

const strengthMeta = [
	{
		label: 'Very weak',
		filledCount: 1,
		barClassName: 'bg-destructive',
		textClassName: 'text-destructive',
	},
	{
		label: 'Weak',
		filledCount: 1,
		barClassName: 'bg-destructive',
		textClassName: 'text-destructive',
	},
	{label: 'Fair', filledCount: 2, barClassName: 'bg-orange-400', textClassName: 'text-orange-400'},
	{label: 'Good', filledCount: 3, barClassName: 'bg-yellow-400', textClassName: 'text-yellow-400'},
	{
		label: 'Strong',
		filledCount: 4,
		barClassName: 'bg-emerald-500',
		textClassName: 'text-emerald-500',
	},
] as const

/** Live strength indicator for a password input, scored by zxcvbn */
export default function PasswordStrengthMeter({
	value,
	userInputs = [],
}: {
	value: string
	/** Memoize to avoid needless re-checks */
	userInputs?: Array<string>
}) {
	const [score, setScore] = useState<Score | null>(null)

	useEffect(() => {
		if (!value) return

		let isStale = false

		/** Debounced so zxcvbn does not run on every keystroke while typing */
		const timeout = setTimeout(() => {
			checkPasswordStrength(value, userInputs)
				.then(({score: nextScore}) => {
					if (!isStale) setScore(nextScore)
				})
				.catch(() => {
					/** Strength is informational, so a failed check just leaves the meter idle */
				})
		}, 200)

		return () => {
			isStale = true
			clearTimeout(timeout)
		}
	}, [value, userInputs])

	const meta = value && score !== null ? strengthMeta[score] : null

	return (
		<div aria-live="polite" className="flex items-center gap-2">
			<div aria-hidden className="flex flex-1 gap-1">
				{Array.from({length: 4}, (_, index) => (
					<div
						key={index}
						className={cn(
							'h-1 flex-1 rounded-full',
							meta && index < meta.filledCount ? meta.barClassName : 'bg-muted',
						)}
					/>
				))}
			</div>

			{/** h-4 reserves the label's line-height so an empty meter doesn't shift the layout */}
			<span className={cn('h-4 w-16 text-right text-xs', meta?.textClassName)}>{meta?.label}</span>
		</div>
	)
}

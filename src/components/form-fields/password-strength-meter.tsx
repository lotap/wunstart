import {Check, X} from 'lucide-react'
import {useEffect, useState} from 'react'

import {Badge} from '#/components/ui/badge.tsx'
import type {PasswordStrength} from '#/isomorphic/password-strength.ts'
import {checkPasswordStrength} from '#/isomorphic/password-strength.ts'
import {cn} from '#/lib/utils.ts'

const strengthMeta = [
	{label: 'Very weak', filledCount: 1, barClassName: 'bg-destructive'},
	{label: 'Weak', filledCount: 1, barClassName: 'bg-destructive'},
	{label: 'Fair', filledCount: 2, barClassName: 'bg-orange-400'},
	{label: 'Good', filledCount: 3, barClassName: 'bg-yellow-400'},
	{label: 'Strong', filledCount: 4, barClassName: 'bg-emerald-500'},
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
	const [strength, setStrength] = useState<PasswordStrength | null>(null)

	useEffect(() => {
		if (!value) return

		let isStale = false

		/** Debounced so zxcvbn does not run on every keystroke while typing */
		const timeout = setTimeout(() => {
			checkPasswordStrength(value, userInputs)
				.then((result) => {
					if (!isStale) setStrength(result)
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

	const meta = value && strength ? strengthMeta[strength.score] : null

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

			{/**
			 * h-5/w-24 reserve the badge's size so it appearing never shifts the
			 * layout. Colors are fixed to the pass/fail threshold so they are
			 * unambiguous; only the bars use the score gradient
			 */}
			<span className="flex h-5 w-24 items-center justify-end">
				{meta ? (
					strength?.isStrong ? (
						<Badge className="bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
							<Check data-icon="inline-start" aria-hidden />
							{meta.label}
						</Badge>
					) : (
						<Badge variant="destructive">
							<X data-icon="inline-start" aria-hidden />
							{meta.label}
						</Badge>
					)
				) : (
					<Badge variant="secondary">Strength</Badge>
				)}
			</span>
		</div>
	)
}

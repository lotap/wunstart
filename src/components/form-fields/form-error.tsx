import {cva} from 'class-variance-authority'
import {CircleAlert} from 'lucide-react'

import {FieldError} from '#/components/ui/field.tsx'

const formErrorVariants = cva('flex items-start gap-2 text-destructive', {
	variants: {
		variant: {
			inline: '',
			banner:
				'rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:outline-none dark:border-destructive/30 dark:bg-destructive/10',
		},
		align: {
			start: '',
			center: 'justify-center text-center',
		},
		isMuted: {
			true: 'opacity-50',
		},
	},
	defaultVariants: {
		variant: 'inline',
		align: 'start',
	},
})

/**
 * Error message for a field or a whole form. Field errors delegate to
 * {@link FieldError}; form errors use one alert with a row per message, so
 * several messages read as one panel instead of stacked alerts. The banner is
 * also the programmatic focus target, so focus does not fall to the body when
 * the submit button disables. `align="center"` matches centered controls such
 * as the passcode slots.
 */
export function FormError({
	id,
	errors,
	variant = 'inline',
	align = 'start',
	isMuted = false,
}: {
	id?: string
	errors?: Array<{message?: string} | undefined>
	variant?: 'inline' | 'banner'
	align?: 'start' | 'center'
	isMuted?: boolean
}) {
	const messages = [
		...new Set(
			errors
				?.map((error) => error?.message)
				.filter((message): message is string => Boolean(message)),
		),
	]

	if (messages.length === 0) return null

	return (
		<div
			className={formErrorVariants({variant, align, isMuted})}
			role={variant === 'banner' ? 'alert' : undefined}
			data-slot={variant === 'banner' ? 'form-error-banner' : undefined}
			tabIndex={variant === 'banner' ? -1 : undefined}
		>
			<CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />

			{variant === 'banner' ? (
				<div className="flex min-w-0 flex-col text-sm font-normal">
					{messages.map((message, index) => (
						<p
							key={message}
							className={index > 0 ? 'mt-2 border-t border-destructive/20 pt-2' : undefined}
						>
							{message}
						</p>
					))}
				</div>
			) : (
				<FieldError id={id} errors={errors} className="min-w-0" />
			)}
		</div>
	)
}

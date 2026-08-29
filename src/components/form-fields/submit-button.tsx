import type {ComponentProps} from 'react'

import {Button} from '#/components/ui/button.tsx'
import {Field} from '#/components/ui/field.tsx'
import {Spinner} from '#/components/ui/spinner.tsx'
import {useFormContext} from '#/hooks/use-app-form.ts'

export function SubmitButton({
	label = 'Submit',
	changeLabelWhileSubmitting = true,
	labelWhileSubmitting = 'Submitting',
	buttonProps = {},
}: {
	label?: string
	changeLabelWhileSubmitting?: boolean
	labelWhileSubmitting?: string
	buttonProps?: ComponentProps<typeof Button>
}) {
	const form = useFormContext()
	return (
		<form.Subscribe selector={(state) => state.isSubmitting}>
			{(isSubmitting) => (
				<Field>
					<Button
						size="lg"
						className="w-full font-bold"
						{...buttonProps}
						type="submit"
						disabled={buttonProps.disabled || isSubmitting}
					>
						{changeLabelWhileSubmitting && isSubmitting ? labelWhileSubmitting : label}
						{changeLabelWhileSubmitting && isSubmitting && <Spinner data-icon="inline-end" />}
					</Button>
				</Field>
			)}
		</form.Subscribe>
	)
}

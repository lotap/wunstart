import type {FieldWithValue} from '@tanstack/react-form'

import {Field, FieldLabel} from '#/components/ui/field.tsx'
import {Input} from '#/components/ui/input.tsx'

import {FormError} from './form-error.tsx'

export function EmailField({
	field,
	formId,
	autoComplete = 'email',
}: {
	field: FieldWithValue<string>
	/** Stable form slug; prefixes the DOM id, not the submitted field name */
	formId: string
	/** Sign-in uses `username`; new and changed addresses use `email` */
	autoComplete?: 'email' | 'username'
}) {
	const isInvalid = field.meta.isTouched && !field.meta.isValid
	const id = `${formId}-${field.name}`
	const errorId = `${id}-error`

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id} className="sr-only">
				Email
			</FieldLabel>

			<Input
				id={id}
				name={field.name}
				type="email"
				value={field.value}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				aria-invalid={isInvalid}
				aria-describedby={isInvalid ? errorId : undefined}
				autoComplete={autoComplete}
				autoCapitalize="none"
				spellCheck={false}
				required
				placeholder="Email address"
				minLength={6}
				maxLength={254}
			/>

			{isInvalid && <FormError id={errorId} errors={field.errors} />}
		</Field>
	)
}

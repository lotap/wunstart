import type {FieldWithValue} from '@tanstack/react-form'

import {Field, FieldError, FieldLabel} from '#/components/ui/field.tsx'
import {Input} from '#/components/ui/input.tsx'

export function EmailField({field}: {field: FieldWithValue<string>}) {
	const isInvalid = field.meta.isTouched && !field.meta.isValid

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name} className="sr-only">
				Email
			</FieldLabel>

			<Input
				id={field.name}
				name={field.name}
				type="email"
				value={field.value}
				onBlur={field.handleBlur}
				onChange={(e) => field.handleChange(e.target.value)}
				aria-invalid={isInvalid}
				placeholder="Email address"
			/>

			{isInvalid && (
				<FieldError aria-describedby={field.name} errors={field.errors} className="text-center" />
			)}
		</Field>
	)
}

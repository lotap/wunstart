import type {FieldWithValue} from '@tanstack/react-form'

import {Checkbox} from '#/components/ui/checkbox.tsx'
import {Field, FieldContent, FieldDescription, FieldLabel} from '#/components/ui/field.tsx'

export function CheckboxField({
	field,
	label,
	description,
}: {
	field: FieldWithValue<boolean | undefined>
	label: string
	description?: string
}) {
	return (
		<Field orientation="horizontal">
			<Checkbox
				id={field.name}
				checked={field.value ?? false}
				onCheckedChange={(checked) => field.handleChange(checked)}
			/>
			<FieldContent>
				<FieldLabel htmlFor={field.name}>{label}</FieldLabel>
				{description && <FieldDescription>{description}</FieldDescription>}
			</FieldContent>
		</Field>
	)
}

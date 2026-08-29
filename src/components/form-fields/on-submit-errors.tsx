import {useSelector} from '@tanstack/react-form'

import {FieldError} from '#/components/ui/field.tsx'
import {useFormContext} from '#/hooks/use-app-form.ts'

export function OnSubmitErrors() {
	const form = useFormContext()
	const errors = useSelector(form.atom, (state) => state.errors)
	return <FieldError errors={errors} className="text-center" />
}

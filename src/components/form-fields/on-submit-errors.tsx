import {useSelector} from '@tanstack/react-form'

import {useFormContext} from '#/hooks/use-app-form.ts'

import {FormError} from './form-error.tsx'

export function OnSubmitErrors() {
	const form = useFormContext()
	const errors = useSelector(form.atom, (state) => state.errors)

	return <FormError variant="banner" errors={errors} />
}

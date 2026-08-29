import {
	createFormHook,
	createValidator,
	formOptions,
	getFormHookHelpers,
} from '@tanstack/react-form'
import {Schema} from 'effect'

import {CheckboxField} from '#/components/form-fields/checkbox.tsx'
import {EmailField} from '#/components/form-fields/email.tsx'
import {OnSubmitErrors} from '#/components/form-fields/on-submit-errors.tsx'
import {PasscodeField} from '#/components/form-fields/passcode.tsx'
import {PasswordField} from '#/components/form-fields/password.tsx'
import {SubmitButton} from '#/components/form-fields/submit-button.tsx'

const {fieldComponent} = getFormHookHelpers()

const AppCheckboxField = fieldComponent.strict(CheckboxField, 'field')
const AppEmailField = fieldComponent.strict(EmailField, 'field')
const AppPasscodeField = fieldComponent.strict(PasscodeField, 'field')
const AppPasswordField = fieldComponent.strict(PasswordField, 'field')

export const {useAppForm, useFormContext} = createFormHook({
	fieldComponents: {
		CheckboxField: AppCheckboxField,
		EmailField: AppEmailField,
		PasscodeField: AppPasscodeField,
		PasswordField: AppPasswordField,
	},
	formComponents: {SubmitButton, OnSubmitErrors},
})

/**
 * Shared validator policy matching the v1 `revalidateLogic()` behavior:
 * schema- or function-based validators stay silent until the first submission
 * attempt, then run on every change and blur.
 */
export const validateAfterFirstSubmit = createValidator({
	triggers: [
		{
			trigger: 'change',
			when: ({formApi}) => formApi.state.submissionAttempts > 0,
		},
		{
			trigger: 'blur',
			when: ({formApi}) => formApi.state.submissionAttempts > 0,
		},
	],
})

type OnSubmitTry<T> = (value: T) => Promise<void> | void

const createFormOptions = <T extends object>({
	defaultValues,
	onSubmitTry,
	onSubmitSchema,
}: {
	defaultValues: T
	onSubmitTry: OnSubmitTry<T>
	onSubmitSchema?: Schema.ConstraintCodec<T, T>
}) => {
	return formOptions({
		defaultValues,
		validators: onSubmitSchema
			? [{run: Schema.toStandardSchemaV1(onSubmitSchema), triggers: []}]
			: [],
		onSubmit: async ({value, createValidationError}) => {
			try {
				await onSubmitTry(value)
				return undefined
			} catch (error) {
				return createValidationError({
					form:
						error instanceof Error
							? error.message
							: 'Something went wrong on our end. Please try again later.',
					fields: {},
				})
			}
		},
	})
}

export function useConfiguredAppForm<T extends object>({
	defaultValues,
	onSubmitTry,
	onSubmitSchema,
}: {
	defaultValues: T
	onSubmitTry: OnSubmitTry<T>
	onSubmitSchema?: Schema.ConstraintCodec<T, T>
}) {
	const appForm = useAppForm(createFormOptions({defaultValues, onSubmitTry, onSubmitSchema}))

	return appForm
}

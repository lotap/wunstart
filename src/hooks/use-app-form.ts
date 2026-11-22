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

/**
 * Mirrors native validation’s focus move after a failed submit: the first
 * invalid control, otherwise the form-level banner. The submit button
 * disables while submitting and drops focus to the body; without this,
 * keyboard users lose their place. Scoped to the form that owns the error so
 * another form on the page is left alone
 */
function focusFirstFormError() {
	const activeForm = document.activeElement?.closest('form')

	const form =
		activeForm ??
		[...document.querySelectorAll('form')].find((candidate) =>
			candidate.querySelector('[aria-invalid="true"], [data-slot="form-error-banner"]'),
		)

	if (!form) return

	const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"]')

	/** The invalid element can be a wrapper (passcode slots); focus its control */
	const invalidControl = invalid?.matches('input, textarea, select, button, [tabindex]')
		? invalid
		: invalid?.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]')

	const target =
		invalidControl ?? form.querySelector<HTMLElement>('[data-slot="form-error-banner"]')

	target?.focus()
}

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
		onSubmitInvalid: () => {
			/** Let the error nodes commit before moving focus to them */
			requestAnimationFrame(focusFirstFormError)
		},
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

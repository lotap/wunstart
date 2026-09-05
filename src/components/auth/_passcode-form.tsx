import {Schema} from 'effect'

import {FieldGroup} from '#/components/ui/field.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {Passcode} from '#/isomorphic/validators.ts'

import {ResetEmailVerificationButton} from './_reset-email-verification-button.tsx'
import type {PasscodeRequestQueryOptions} from './_utils.ts'

type PasscodeSubmitCredentials = {passcode: string; email?: string}

export function PasscodeForm({
	onSubmitSchema,
	onSubmitTry,
	email,
	passcodeRequestQueryOptions,
	mutatePasscodeRequest,
	mutatePasscodeRequestIsPending,
}: {
	onSubmitSchema?: Schema.ConstraintCodec<PasscodeSubmitCredentials>
	onSubmitTry: (value: PasscodeSubmitCredentials) => Promise<void>
	email: string
	passcodeRequestQueryOptions: PasscodeRequestQueryOptions
	mutatePasscodeRequest: () => Promise<{expiresAt: Date}>
	mutatePasscodeRequestIsPending: boolean
}) {
	const form = useConfiguredAppForm({
		defaultValues: {email, passcode: ''},
		onSubmitSchema,
		onSubmitTry,
	})

	return (
		<form.AppForm>
			<form
				className="w-full"
				onSubmit={(e) => {
					e.preventDefault()
					e.stopPropagation()
					void form.handleSubmit()
				}}
				action="#"
			>
				<FieldGroup>
					<form.Field
						name="passcode"
						validators={[validateAfterFirstSubmit(Schema.toStandardSchemaV1(Passcode))]}
					>
						{(field) => <field.PasscodeField onComplete={() => form.handleSubmit()} />}
					</form.Field>

					<ResetEmailVerificationButton
						email={email}
						queryOptions={passcodeRequestQueryOptions}
						mutateAsync={mutatePasscodeRequest}
						mutationIsPending={mutatePasscodeRequestIsPending}
						onRequestNewCode={() => form.resetField('passcode')}
					/>

					<form.OnSubmitErrors />

					<form.SubmitButton label="Next" labelWhileSubmitting="Verifying" />
				</FieldGroup>
			</form>
		</form.AppForm>
	)
}

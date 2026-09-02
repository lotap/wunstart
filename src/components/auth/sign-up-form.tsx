import {useSelector} from '@tanstack/react-form'
import {Link, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {ArrowLeft} from 'lucide-react'
import {useState} from 'react'

import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {
	EmailRequestVerificationCredentials,
	EmailSignUpCredentials,
} from '#/isomorphic/validations/auth.ts'
import {Email} from '#/isomorphic/validators.ts'
import {handleEmailRequestVerification} from '#/server-fns/handle-email-request-verification.ts'
import {handleEmailSignUp} from '#/server-fns/handle-email-sign-up.ts'

import {Button} from '../ui/button.tsx'
import {FieldDescription, FieldGroup} from '../ui/field.tsx'
import {Skeleton} from '../ui/skeleton.tsx'
import {FormHeading} from './_form-heading.tsx'
import {
	useAuthFormEmailState,
	useLocalStorageAuthFormState,
	useLocalStorageEmail,
} from './_hooks.ts'
import {PasscodeForm} from './_passcode-form.tsx'

const LinkToSignIn = () => (
	<Link to="/sign-in" className="mt-10 font-bold text-muted-foreground hover:underline">
		Already have an account?
	</Link>
)

export function SignUpForm() {
	const handleEmailRequestVerificationFn = useServerFn(handleEmailRequestVerification)
	const handleEmailSignUpFn = useServerFn(handleEmailSignUp)

	const router = useRouter()

	const {
		query: {data: localStorageEmail},
	} = useLocalStorageEmail()

	const {
		step,
		setStep,
		isPending: localStorageSignUpStateIsPending,
		remove: removeLocalStorageSignUpState,
	} = useLocalStorageAuthFormState({
		key: 'sign-up-state',
	})

	const [branch, setBranch] = useState<'default' | 'skip'>('default')

	const step0Form = useConfiguredAppForm({
		defaultValues: {email: localStorageEmail?.email ?? ''},
		onSubmitSchema: branch === 'default' ? EmailRequestVerificationCredentials : undefined,
		onSubmitTry: async () => {
			handleEmailChange(email)
			if (branch === 'default')
				await mutateEmailRequestVerification({email, expectRegisteredRecipient: false})
			setStep(1)
		},
	})

	const email = useSelector(step0Form.atom, (state) => state.values.email)

	const signUpStep0FormIsSubmitting = useSelector(step0Form.atom, (state) => state.isSubmitting)

	const {
		localStorageEmailIsPending,
		emailRequestVerificationOptions,
		mutateEmailRequestVerification,
		emailRequestVerificationIsPending,
		handleEmailChange,
	} = useAuthFormEmailState({
		serverFn: handleEmailRequestVerificationFn,
		email,
		expectRegisteredRecipient: false,
	})

	if (localStorageSignUpStateIsPending || localStorageEmailIsPending)
		return (
			<div className="mx-auto flex w-full max-w-sm flex-col items-center p-4">
				<Skeleton className="mb-3 h-10 w-full" />
				<Skeleton className="mb-10 h-7 w-full" />
				<Skeleton className="mb-4 h-8 w-full" />
				<Skeleton className="mb-4 h-9 w-full" />
				<Skeleton className="mb-4 h-7 w-1/3" />
				<Skeleton className="h-10 w-full" />
				<LinkToSignIn />
			</div>
		)

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col items-center p-4">
			{step === 0 && (
				<step0Form.AppForm>
					<FormHeading headline="Sign up" subhead="Create an account" />

					<form
						className="w-full max-w-sm"
						onSubmit={(e) => {
							e.preventDefault()
							e.stopPropagation()
							void step0Form.handleSubmit()
						}}
						action="#"
					>
						<FieldGroup>
							<FieldGroup>
								<step0Form.Field
									name="email"
									listeners={[
										{
											/**
											 * Using listeners instead of useEffect prevents bug where
											 * localStorage email is overwritten by empty string
											 */
											triggers: ['change'],
											triggerDebounceMs: 500,
											run: ({value}) => {
												handleEmailChange(value)
											},
										},
									]}
									validators={[validateAfterFirstSubmit(Schema.toStandardSchemaV1(Email))]}
								>
									{(field) => <field.EmailField />}
								</step0Form.Field>

								<step0Form.OnSubmitErrors />

								<step0Form.SubmitButton
									buttonProps={{disabled: branch !== 'default'}}
									label="Continue"
									changeLabelWhileSubmitting={branch === 'default'}
									labelWhileSubmitting="Sending Code"
								/>

								<step0Form.SubmitButton
									buttonProps={{
										size: 'sm',
										variant: 'ghost',
										className: 'text-muted-foreground',
										onMouseEnter: () => {
											if (!signUpStep0FormIsSubmitting) setBranch('skip')
										},
										onMouseLeave: () => {
											if (!signUpStep0FormIsSubmitting) setBranch('default')
										},
										onFocus: () => {
											if (!signUpStep0FormIsSubmitting) setBranch('skip')
										},
										onBlur: () => {
											if (!signUpStep0FormIsSubmitting) setBranch('default')
										},
										onClick: () => {
											if (!signUpStep0FormIsSubmitting) setBranch('skip')
										},
									}}
									label="Have a Passcode?"
									changeLabelWhileSubmitting={branch === 'skip'}
									labelWhileSubmitting=""
								/>
							</FieldGroup>

							<FieldDescription className="text-center">
								{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid */}
								By continuing, you agree to our <a href="#">Terms&nbsp;of&nbsp;Service</a>,{' '}
								{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid */}
								<a href="#">Privacy&nbsp;Policy</a>, and&nbsp;
								{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid */}
								<a href="#">Cookie&nbsp;Policy</a>.
							</FieldDescription>
						</FieldGroup>
					</form>
				</step0Form.AppForm>
			)}

			{step === 1 && (
				<>
					<Button
						variant="ghost"
						size="sm"
						className="mb-7 -ml-2 self-start text-muted-foreground"
						onClick={() => {
							setStep(0)
							setBranch('default')
						}}
					>
						<ArrowLeft data-icon="inline-start" /> Change email
					</Button>

					<FormHeading
						headline="Verify your email"
						subhead={
							<>
								We sent a 6-digit code to <strong>{email}</strong>
							</>
						}
					/>

					<PasscodeForm
						onSubmitSchema={EmailSignUpCredentials}
						onSubmitTry={async ({passcode}) => {
							await handleEmailSignUpFn({data: {email, passcode}})
							removeLocalStorageSignUpState()
							void router.navigate({to: '/', state: {welcome: true}})
						}}
						email={email}
						emailRequestVerificationQueryOptions={emailRequestVerificationOptions}
						mutateEmailRequestVerification={() =>
							mutateEmailRequestVerification({email, expectRegisteredRecipient: false})
						}
						mutateEmailRequestVerificationIsPending={emailRequestVerificationIsPending}
					/>
				</>
			)}

			<LinkToSignIn />
		</div>
	)
}

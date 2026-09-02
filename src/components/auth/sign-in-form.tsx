import {useSelector} from '@tanstack/react-form'
import {Link, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {ArrowLeft} from 'lucide-react'
import {useState} from 'react'

import {Button} from '#/components/ui/button.tsx'
import {FieldGroup, FieldSeparator} from '#/components/ui/field.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {EmailSignInCredentials} from '#/isomorphic/validations/auth.ts'
import {Email, Password} from '#/isomorphic/validators.ts'
import {handleEmailRequestVerification} from '#/server-fns/handle-email-request-verification.ts'
import {handleEmailSignIn} from '#/server-fns/handle-email-sign-in.ts'
import {handlePasswordSignIn} from '#/server-fns/handle-password-sign-in.ts'

import {FormHeading} from './_form-heading.tsx'
import {
	useAuthFormEmailState,
	useLocalStorageAuthFormState,
	useLocalStorageEmail,
} from './_hooks.ts'
import {PasscodeForm} from './_passcode-form.tsx'

const LinkToSignUp = () => (
	<Link to="/sign-up" className="mt-10 font-bold text-muted-foreground hover:underline">
		Don’t have an account?
	</Link>
)

export function SignInForm() {
	const handlePasswordSignInFn = useServerFn(handlePasswordSignIn)
	const handleEmailRequestVerificationFn = useServerFn(handleEmailRequestVerification)
	const handleEmailSignInFn = useServerFn(handleEmailSignIn)

	const router = useRouter()

	const {
		query: {data: localStorageEmail},
	} = useLocalStorageEmail()

	const {
		step,
		setStep,
		isPending: localStorageSignInStateIsPending,
		remove: removeLocalStorageSignInState,
	} = useLocalStorageAuthFormState({
		key: 'sign-in-state',
	})

	const [branch, setBranch] = useState<'password' | 'passcode-send' | 'passcode-skip'>('password')
	const [submittedBranch, setSubmittedBranch] = useState(branch)

	const step0Form = useConfiguredAppForm({
		defaultValues: {
			email: localStorageEmail?.email ?? '',
			password: '',
		},
		onSubmitTry: async ({password}) => {
			handleEmailChange(email)
			setSubmittedBranch(branch)
			if (branch === 'password') {
				await handlePasswordSignInFn({data: {email, password}})
				removeLocalStorageSignInState()
				void router.navigate({to: '/'})
			} else if (branch === 'passcode-send') {
				await mutateEmailRequestVerification({email, expectRegisteredRecipient: true})
				setStep(1)
			} else {
				setStep(1)
			}
		},
	})

	const email = useSelector(step0Form.atom, (state) => state.values.email)

	const step0FormIsSubmitting = useSelector(step0Form.atom, (state) => state.isSubmitting)

	const {
		localStorageEmailIsPending,
		emailRequestVerificationOptions,
		mutateEmailRequestVerification,
		emailRequestVerificationIsPending,
		handleEmailChange,
	} = useAuthFormEmailState({
		serverFn: handleEmailRequestVerificationFn,
		email,
		expectRegisteredRecipient: true,
	})

	if (localStorageSignInStateIsPending || localStorageEmailIsPending)
		return (
			<div className="mx-auto flex w-full max-w-sm flex-col items-center p-4">
				<Skeleton className="mb-3 h-10 w-full" />
				<Skeleton className="mb-10 h-7 w-full" />
				<Skeleton className="mb-4 h-8 w-full" />
				<Skeleton className="mb-4 h-8 w-full" />
				<Skeleton className="mb-2.5 h-9 w-full" />
				<Skeleton className="mb-2.5 size-5" />
				<Skeleton className="mb-4 h-9 w-full" />
				<Skeleton className="h-7 w-1/2" />
				<LinkToSignUp />
			</div>
		)

	return (
		<div className="mx-auto flex w-full max-w-sm flex-col items-center p-4">
			{step === 0 && (
				<step0Form.AppForm>
					<FormHeading headline="Sign in" subhead="Welcome back!" />

					<form
						className="w-full"
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

								<step0Form.Field
									name="password"
									validators={[
										{
											run: Schema.toStandardSchemaV1(Password),
											/**
											 * `triggers[].when` is not consulted on submit, so submit
											 * gating needs `runOnSubmit`
											 */
											runOnSubmit: () => branch === 'password',
											triggers: [
												{
													trigger: 'change',
													when: ({formApi}) =>
														branch === 'password' && formApi.state.submissionAttempts > 0,
												},
												{
													trigger: 'blur',
													when: ({formApi}) =>
														branch === 'password' && formApi.state.submissionAttempts > 0,
												},
											],
										},
									]}
								>
									{(field) => <field.PasswordField isDisabled={branch !== 'password'} />}
								</step0Form.Field>

								{submittedBranch !== 'passcode-send' && <step0Form.OnSubmitErrors />}

								<step0Form.SubmitButton
									buttonProps={{disabled: branch !== 'password'}}
									label="Continue"
									changeLabelWhileSubmitting={branch === 'password'}
									labelWhileSubmitting="Authenticating"
								/>
							</FieldGroup>

							<FieldSeparator>Or</FieldSeparator>

							<FieldGroup>
								<step0Form.SubmitButton
									buttonProps={{
										variant: 'outline',
										onMouseEnter: () => {
											if (!step0FormIsSubmitting) setBranch('passcode-send')
										},
										onMouseLeave: () => {
											if (!step0FormIsSubmitting) setBranch('password')
										},
										onFocus: () => {
											if (!step0FormIsSubmitting) setBranch('passcode-send')
										},
										onBlur: () => {
											if (!step0FormIsSubmitting) setBranch('password')
										},
										onClick: () => {
											if (!step0FormIsSubmitting) setBranch('passcode-send')
										},
									}}
									label="Send a Passcode"
									changeLabelWhileSubmitting={branch === 'passcode-send'}
									labelWhileSubmitting="Sending code"
								/>

								{submittedBranch === 'passcode-send' && <step0Form.OnSubmitErrors />}

								<step0Form.SubmitButton
									buttonProps={{
										size: 'sm',
										variant: 'ghost',
										className: 'text-muted-foreground',
										onMouseEnter: () => {
											if (!step0FormIsSubmitting) setBranch('passcode-skip')
										},
										onMouseLeave: () => {
											if (!step0FormIsSubmitting) setBranch('password')
										},
										onFocus: () => {
											if (!step0FormIsSubmitting) setBranch('passcode-skip')
										},
										onBlur: () => {
											if (!step0FormIsSubmitting) setBranch('password')
										},
										onClick: () => {
											if (!step0FormIsSubmitting) setBranch('passcode-skip')
										},
									}}
									label="Already Have a Passcode?"
									changeLabelWhileSubmitting={branch === 'passcode-skip'}
									labelWhileSubmitting=""
								/>
							</FieldGroup>
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
							setBranch('password')
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
						onSubmitSchema={EmailSignInCredentials}
						onSubmitTry={async ({passcode}) => {
							await handleEmailSignInFn({data: {email, passcode}})
							removeLocalStorageSignInState()
							void router.navigate({to: '/'})
						}}
						email={email}
						emailRequestVerificationQueryOptions={emailRequestVerificationOptions}
						mutateEmailRequestVerification={() =>
							mutateEmailRequestVerification({email, expectRegisteredRecipient: true})
						}
						mutateEmailRequestVerificationIsPending={emailRequestVerificationIsPending}
					/>
				</>
			)}

			<LinkToSignUp />
		</div>
	)
}

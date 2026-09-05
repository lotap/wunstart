import {useSelector} from '@tanstack/react-form'
import {Link, useRouter, useSearch} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {ArrowLeft} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'

import {Button} from '#/components/ui/button.tsx'
import {FieldGroup, FieldSeparator} from '#/components/ui/field.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'
import {Email, Password} from '#/isomorphic/validators.ts'
import {handleEmailRequestPasscode} from '#/server-fns/handle-email-request-passcode.ts'
import {handleEmailVerifyPasscode} from '#/server-fns/handle-email-verify-passcode.ts'
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

/** Same-origin redirect targets only; anything else falls back to the dashboard */
function safeRedirectTarget(raw?: string) {
	if (raw) {
		try {
			const url = new URL(raw, window.location.origin)
			if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`
		} catch {
			// Adversarial or malformed params (e.g. `redirect=https://[`) can throw here;
			// fall through to the dashboard rather than failing the sign-in
		}
	}
	return '/'
}

export function SignInForm() {
	const handlePasswordSignInFn = useServerFn(handlePasswordSignIn)
	const handleEmailRequestPasscodeFn = useServerFn(handleEmailRequestPasscode)
	const handleEmailVerifyPasscodeFn = useServerFn(handleEmailVerifyPasscode)

	const router = useRouter()

	const {redirect} = useSearch({from: '/_auth-gateway/sign-in'})

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
	const [submittedBranch, setSubmittedBranch] = useState<
		'password' | 'passcode-send' | 'passcode-skip'
	>('password')
	/** Set synchronously on click so onSubmitTry reliably observes the intended branch */
	const branchRef = useRef<'password' | 'passcode-send' | 'passcode-skip'>('password')

	const step0Form = useConfiguredAppForm({
		defaultValues: {
			email: localStorageEmail?.email ?? '',
			password: '',
		},
		onSubmitTry: async ({password}) => {
			handleEmailChange(email)
			setSubmittedBranch(branchRef.current)
			if (branchRef.current === 'password') {
				await handlePasswordSignInFn({data: {email, password}})
				removeLocalStorageSignInState()
				router.history.push(safeRedirectTarget(redirect))
			} else if (branchRef.current === 'passcode-send') {
				await mutatePasscodeRequest()
				setStep(1)
			} else {
				setStep(1)
			}
		},
	})

	const email = useSelector(step0Form.atom, (state) => state.values.email)

	const step0FormIsSubmitting = useSelector(step0Form.atom, (state) => state.isSubmitting)

	const backButtonRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (step === 1) backButtonRef.current?.focus()
	}, [step])

	const {
		localStorageEmailIsPending,
		passcodeRequestOptions,
		mutatePasscodeRequest,
		passcodeRequestIsPending,
		handleEmailChange,
	} = useAuthFormEmailState({
		serverFn: () => handleEmailRequestPasscodeFn({data: {email, intent: 'sign-in'}}),
		email,
		intent: 'sign-in',
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
											if (!step0FormIsSubmitting) {
												branchRef.current = 'passcode-send'
												setBranch('passcode-send')
											}
										},
										onMouseLeave: () => {
											if (!step0FormIsSubmitting) {
												branchRef.current = 'password'
												setBranch('password')
											}
										},
										onFocus: () => {
											if (!step0FormIsSubmitting) {
												branchRef.current = 'passcode-send'
												setBranch('passcode-send')
											}
										},
										onBlur: () => {
											if (!step0FormIsSubmitting) {
												branchRef.current = 'password'
												setBranch('password')
											}
										},
										onClick: () => {
											branchRef.current = 'passcode-send'
											setBranch('passcode-send')
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
											if (!step0FormIsSubmitting) {
												branchRef.current = 'passcode-skip'
												setBranch('passcode-skip')
											}
										},
										onMouseLeave: () => {
											if (!step0FormIsSubmitting) {
												branchRef.current = 'password'
												setBranch('password')
											}
										},
										onFocus: () => {
											if (!step0FormIsSubmitting) {
												branchRef.current = 'passcode-skip'
												setBranch('passcode-skip')
											}
										},
										onBlur: () => {
											if (!step0FormIsSubmitting) {
												branchRef.current = 'password'
												setBranch('password')
											}
										},
										onClick: () => {
											branchRef.current = 'passcode-skip'
											setBranch('passcode-skip')
										},
									}}
									label="Already Have a Passcode?"
									changeLabelWhileSubmitting={branch === 'passcode-skip'}
									labelWhileSubmitting="Loading"
								/>
							</FieldGroup>
						</FieldGroup>
					</form>
				</step0Form.AppForm>
			)}

			{step === 1 && (
				<>
					<Button
						ref={backButtonRef}
						variant="ghost"
						size="sm"
						className="mb-7 -ml-2 self-start text-muted-foreground"
						onClick={() => {
							setStep(0)
							setBranch('password')
							branchRef.current = 'password'
						}}
					>
						<ArrowLeft data-icon="inline-start" /> Change email
					</Button>

					<FormHeading
						headline="Verify your email"
						subhead={
							<>
								We sent a passcode/instructions to <strong>{email}</strong>
							</>
						}
					/>

					<PasscodeForm
						onSubmitSchema={EmailPasscodeCredentials}
						onSubmitTry={async ({passcode}) => {
							await handleEmailVerifyPasscodeFn({data: {email, passcode}})
							removeLocalStorageSignInState()
							router.history.push(safeRedirectTarget(redirect))
						}}
						email={email}
						passcodeRequestQueryOptions={passcodeRequestOptions}
						mutatePasscodeRequest={mutatePasscodeRequest}
						mutatePasscodeRequestIsPending={passcodeRequestIsPending}
					/>
				</>
			)}

			<LinkToSignUp />
		</div>
	)
}

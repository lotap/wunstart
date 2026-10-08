import {useSelector} from '@tanstack/react-form'
import {Link, useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {ArrowLeft} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'

import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {EmailCredentials, EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'
import {Email} from '#/isomorphic/validators.ts'
import {handleEmailRequestPasscode} from '#/server-fns/handle-email-request-passcode.ts'
import {handleEmailVerifyPasscode} from '#/server-fns/handle-email-verify-passcode.ts'

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
	const handleEmailRequestPasscodeFn = useServerFn(handleEmailRequestPasscode)
	const handleEmailVerifyPasscodeFn = useServerFn(handleEmailVerifyPasscode)

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
	/** Set synchronously on click so onSubmitTry observes the intended branch without hover/focus pre-sets */
	const branchRef = useRef<'default' | 'skip'>('default')

	const step0Form = useConfiguredAppForm({
		defaultValues: {email: localStorageEmail?.email ?? ''},
		onSubmitSchema: branch === 'default' ? EmailCredentials : undefined,
		onSubmitTry: async () => {
			handleEmailChange(email)
			if (branchRef.current === 'default') await mutatePasscodeRequest()
			setStep(1)
		},
	})

	const email = useSelector(step0Form.atom, (state) => state.values.email)

	const signUpStep0FormIsSubmitting = useSelector(step0Form.atom, (state) => state.isSubmitting)

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
		serverFn: () => handleEmailRequestPasscodeFn({data: {email, intent: 'sign-up'}}),
		email,
		intent: 'sign-up',
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
											if (!signUpStep0FormIsSubmitting) {
												branchRef.current = 'skip'
												setBranch('skip')
											}
										},
										onMouseLeave: () => {
											if (!signUpStep0FormIsSubmitting) {
												branchRef.current = 'default'
												setBranch('default')
											}
										},
										onFocus: () => {
											if (!signUpStep0FormIsSubmitting) {
												branchRef.current = 'skip'
												setBranch('skip')
											}
										},
										onBlur: () => {
											if (!signUpStep0FormIsSubmitting) {
												branchRef.current = 'default'
												setBranch('default')
											}
										},
										onClick: () => {
											branchRef.current = 'skip'
											setBranch('skip')
										},
									}}
									label="Have a Passcode?"
									changeLabelWhileSubmitting={branch === 'skip'}
									labelWhileSubmitting="Loading"
								/>
							</FieldGroup>

							<FieldDescription className="text-center">
								{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid react-doctor/anchor-is-valid */}
								By continuing, you agree to our <a href="#">Terms&nbsp;of&nbsp;Service</a>,{' '}
								{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid react-doctor/anchor-is-valid */}
								<a href="#">Privacy&nbsp;Policy</a>, and&nbsp;
								{/* oxlint-disable-next-line jsx-a11y/anchor-is-valid react-doctor/anchor-is-valid */}
								<a href="#">Cookie&nbsp;Policy</a>.
							</FieldDescription>
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
							setBranch('default')
							branchRef.current = 'default'
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
							/**
							 * Cross-over sign-ins (existing account, sign-up form) must
							 * not trigger the welcome page
							 */
							const {isNewUser} = await handleEmailVerifyPasscodeFn({data: {email, passcode}})
							removeLocalStorageSignUpState()
							void router.navigate({to: '/', state: {welcome: isNewUser}})
						}}
						email={email}
						passcodeRequestQueryOptions={passcodeRequestOptions}
						mutatePasscodeRequest={mutatePasscodeRequest}
						mutatePasscodeRequestIsPending={passcodeRequestIsPending}
					/>
				</>
			)}

			<LinkToSignIn />
		</div>
	)
}

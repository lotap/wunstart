import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer'
import {useQueryClient, useSuspenseQuery} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {useEffect, useState, type Dispatch, type SetStateAction} from 'react'

import {AsyncBoundary} from '#/components/async-boundary.tsx'
import {Button} from '#/components/ui/button.tsx'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from '#/components/ui/drawer.tsx'
import {FieldGroup} from '#/components/ui/field.tsx'
import {Spinner} from '#/components/ui/spinner.tsx'
import {toast} from '#/components/ui/toast.tsx'
import {useHasSudo} from '#/contexts/has-sudo.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {PasscodeCredentials, PasswordCredentials} from '#/isomorphic/validations/auth.ts'
import {Password} from '#/isomorphic/validators.ts'
import {handleEmailRequestPasscodeFromSession} from '#/server-fns/handle-email-request-passcode-from-session.ts'
import {handleEmailReverify} from '#/server-fns/handle-email-reverify.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'
import {handlePasswordReverify} from '#/server-fns/handle-password-reverify.ts'

import {usePasscodeRequestMutation} from './_hooks.ts'
import {PasscodeForm} from './_passcode-form.tsx'
import {passcodeRequestQueryOptions, userProfileQueryOptions} from './_utils.ts'

/**
 * Reverification via email passcode.
 *
 * The `passcodeRequest` query cache this form reads and writes is a
 * last-send record only — when a code was emailed and how long its resend
 * cooldown runs. It is never a validity signal: a code can be burned by any
 * flow (sign-in, sign-up, reverify), superseded by a newer send, maxed out on
 * attempts, or expired while still cached. Server-side there is a single
 * verification row per email, so codes are interchangeable across flows until
 * burned. Never gate UI state on this cache — it cannot tell you whether an
 * entry-worthy code exists. This form tracks its own send in local state so
 * the drawer always opens at the send step
 */
function ReverifyEmailForm({email}: {email: string}) {
	const handleEmailRequestPasscodeFromSessionFn = useServerFn(handleEmailRequestPasscodeFromSession)
	const handleEmailReverifyFn = useServerFn(handleEmailReverify)

	const _passcodeRequestQueryOptions = passcodeRequestQueryOptions({
		serverFn: handleEmailRequestPasscodeFromSessionFn,
		email,
		intent: 'reverify',
	})

	const {mutatePasscodeRequest, passcodeRequestIsPending} = usePasscodeRequestMutation({
		serverFn: handleEmailRequestPasscodeFromSessionFn,
		invalidationKey: _passcodeRequestQueryOptions.queryKey,
	})

	const {setSudoExpiresAt} = useHasSudo()

	/**
	 * Per the cache contract above, the drawer must not infer "code was sent"
	 * from the shared cache, so the send is tracked locally instead
	 */
	const [passcodeSent, setPasscodeSent] = useState(false)

	if (!passcodeSent)
		return (
			<div className="flex w-full max-w-sm flex-col items-center gap-3">
				<p className="text-center">
					We’ll send a secret code to your registered email address: <strong>{email}</strong> to
					verify your&nbsp;access.
				</p>
				<Button
					className="w-full"
					disabled={passcodeRequestIsPending}
					onClick={async () => {
						try {
							await mutatePasscodeRequest()
							setPasscodeSent(true)
						} catch (error) {
							toast.add({
								type: 'error',
								title:
									error instanceof Error
										? error.message
										: 'Something went wrong on our end. Please try again later.',
							})
						}
					}}
				>
					Send it
					{passcodeRequestIsPending && <Spinner data-icon="inline-end" />}
				</Button>
			</div>
		)

	return (
		<div className="w-full max-w-sm">
			<div className="mb-3 text-center">
				We sent a 6-digit code to <strong>{email}</strong>
			</div>

			<PasscodeForm
				onSubmitSchema={PasscodeCredentials}
				onSubmitTry={async ({passcode}) => {
					const {sudoExpiresAt} = await handleEmailReverifyFn({data: {passcode}})
					setSudoExpiresAt(sudoExpiresAt)
				}}
				email={email}
				passcodeRequestQueryOptions={_passcodeRequestQueryOptions}
				mutatePasscodeRequest={mutatePasscodeRequest}
				mutatePasscodeRequestIsPending={passcodeRequestIsPending}
			/>
		</div>
	)
}

function ConfirmPasswordForm() {
	const handlePasswordReverifyFn = useServerFn(handlePasswordReverify)

	const {setSudoExpiresAt} = useHasSudo()

	const form = useConfiguredAppForm({
		defaultValues: {
			password: '',
		},
		onSubmitSchema: PasswordCredentials,
		onSubmitTry: async ({password}) => {
			const {sudoExpiresAt} = await handlePasswordReverifyFn({data: {password}})
			setSudoExpiresAt(sudoExpiresAt)
		},
	})

	return (
		<form.AppForm>
			<div className="w-full max-w-sm">
				<div className="mb-3">Confirm your password</div>

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
						<FieldGroup>
							<form.Field
								name="password"
								validators={[validateAfterFirstSubmit(Schema.toStandardSchemaV1(Password))]}
							>
								{(field) => <field.PasswordField />}
							</form.Field>

							<form.OnSubmitErrors />

							<form.SubmitButton label="Confirm" labelWhileSubmitting="Authenticating" />
						</FieldGroup>
					</FieldGroup>
				</form>
			</div>
		</form.AppForm>
	)
}

function ReverifyFormSwitcher({email, hasPassword}: {email: string; hasPassword: boolean}) {
	const [selectedForm, selectForm] = useState<'confirm-password' | 'email-passcode'>(
		hasPassword ? 'confirm-password' : 'email-passcode',
	)

	if (selectedForm === 'confirm-password')
		return (
			<>
				<ConfirmPasswordForm />
				<Button
					variant="ghost"
					size="sm"
					className="mt-3 w-full max-w-sm"
					onClick={() => {
						selectForm('email-passcode')
					}}
				>
					Send a Passcode Instead
				</Button>
			</>
		)

	return (
		<>
			<ReverifyEmailForm email={email} />
			{hasPassword && (
				<Button
					variant="ghost"
					size="sm"
					className="mt-3 w-full max-w-sm"
					onClick={() => {
						selectForm('confirm-password')
					}}
				>
					Confirm Password Instead
				</Button>
			)}
		</>
	)
}

function ReverifyError() {
	const queryClient = useQueryClient()
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)
	return (
		<div className="flex flex-col items-center gap-3 text-center">
			<p>Couldn’t load the verification form. Please try again.</p>
			<Button
				variant="outline"
				onClick={() => {
					void queryClient.invalidateQueries({
						queryKey: userProfileQueryOptions({serverFn: handleGetUserProfileFn}).queryKey,
					})
				}}
			>
				Retry
			</Button>
		</div>
	)
}

function ReverifyFormFetcher() {
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {data} = useSuspenseQuery(userProfileQueryOptions({serverFn: handleGetUserProfileFn}))

	return <ReverifyFormSwitcher {...data} />
}

export function ReverifyDrawer({
	open,
	setOpen,
	closeCallerDrawer,
}: {
	open: boolean
	setOpen: Dispatch<SetStateAction<boolean>>
	closeCallerDrawer?: () => void
}) {
	/**
	 * The lazy chunk usually finishes loading after the caller has already flipped `open`
	 * to true, so this component mounts already-open and the enter transition never plays.
	 * Holding the drawer closed for one frame after mount gives Base UI the closed→open
	 * transition it needs to animate in.
	 */
	const [hasMounted, setHasMounted] = useState(false)

	// oxlint-disable-next-line react-doctor/rendering-hydration-no-flicker
	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect react-hooks-js/set-state-in-effect react-doctor/no-initialize-state
		setHasMounted(true)
	}, [])

	return (
		<Drawer
			showSwipeHandle
			open={open && hasMounted}
			onOpenChange={(isOpen) => {
				setOpen(isOpen)
				if (!isOpen && closeCallerDrawer) closeCallerDrawer()
			}}
		>
			<DrawerPrimitive.VirtualKeyboardProvider>
				<DrawerContent className="min-h-2/3">
					<DrawerHeader>
						<DrawerTitle className="text-4xl font-bold">Reverify Your Account</DrawerTitle>
						<DrawerDescription>We want to make sure it’s really you</DrawerDescription>
					</DrawerHeader>
					<div className="flex grow flex-col items-center justify-center p-4">
						<AsyncBoundary fallback={<Spinner />} errorFallback={<ReverifyError />}>
							<ReverifyFormFetcher />
						</AsyncBoundary>
					</div>
					<DrawerFooter>
						<DrawerClose
							render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}
						>
							Cancel
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</DrawerPrimitive.VirtualKeyboardProvider>
		</Drawer>
	)
}

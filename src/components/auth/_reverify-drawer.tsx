import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer'
import {useQuery, useSuspenseQuery, queryOptions} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {Suspense, useEffect, useState, type Dispatch, type SetStateAction} from 'react'
import {toast} from 'sonner'

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
import {useHasSudo} from '#/contexts/has-sudo.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {
	EmailReverifyCredentials,
	PasswordReverifyCredentials,
} from '#/isomorphic/validations/auth.ts'
import {Password} from '#/isomorphic/validators.ts'
import {handleEmailRequestVerification} from '#/server-fns/handle-email-request-verification.ts'
import {handleEmailReverify} from '#/server-fns/handle-email-reverify.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'
import {handlePasswordReverify} from '#/server-fns/handle-password-reverify.ts'

import {useEmailRequestVerificationMutation} from './_hooks.ts'
import {PasscodeForm} from './_passcode-form.tsx'
import {emailRequestVerificationQueryOptions} from './_utils.ts'

function ReverifyEmailForm({email}: {email: string}) {
	const handleEmailRequestVerificationFn = useServerFn(handleEmailRequestVerification)
	const handleEmailReverifyFn = useServerFn(handleEmailReverify)

	const _emailRequestVerificationQueryOptions = emailRequestVerificationQueryOptions({
		serverFn: handleEmailRequestVerificationFn,
		email,
		expectRegisteredRecipient: true,
	})

	const {data: emailRequestVerificationData} = useQuery(_emailRequestVerificationQueryOptions)

	const {mutateEmailRequestVerification, emailRequestVerificationIsPending} =
		useEmailRequestVerificationMutation({
			serverFn: handleEmailRequestVerificationFn,
			invalidationKey: _emailRequestVerificationQueryOptions.queryKey,
		})

	const {setSudoExpiresAt} = useHasSudo()

	if (!emailRequestVerificationData)
		return (
			<div className="flex w-full max-w-sm flex-col items-center gap-3">
				<p className="text-center">
					We’ll send a secret code to your registered email address: <strong>{email}</strong> to
					verify your&nbsp;access.
				</p>
				<Button
					className="w-full"
					disabled={emailRequestVerificationIsPending}
					onClick={async () => {
						try {
							await mutateEmailRequestVerification({email, expectRegisteredRecipient: true})
						} catch (error) {
							toast.error(
								error instanceof Error
									? error.message
									: 'Something went wrong on our end. Please try again later.',
								{position: 'bottom-center'},
							)
						}
					}}
				>
					Send it
					{emailRequestVerificationIsPending && <Spinner data-icon="inline-end" />}
				</Button>
			</div>
		)

	return (
		<div className="w-full max-w-sm">
			<div className="mb-3 text-center">
				We sent a 6-digit code to <strong>{email}</strong>
			</div>

			<PasscodeForm
				onSubmitSchema={EmailReverifyCredentials}
				onSubmitTry={async ({passcode}) => {
					const {sudoExpiresAt} = await handleEmailReverifyFn({data: {passcode}})
					setSudoExpiresAt(sudoExpiresAt)
				}}
				email={email}
				emailRequestVerificationQueryOptions={_emailRequestVerificationQueryOptions}
				mutateEmailRequestVerification={() =>
					mutateEmailRequestVerification({email, expectRegisteredRecipient: true})
				}
				mutateEmailRequestVerificationIsPending={emailRequestVerificationIsPending}
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
		onSubmitSchema: PasswordReverifyCredentials,
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

const userProfileQueryOptions = ({
	serverFn,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleGetUserProfile>>
}) =>
	queryOptions({
		queryKey: [serverFn],
		queryFn: () => serverFn(),
		staleTime: Infinity,
	})

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

	useEffect(() => {
		// oxlint-disable-next-line react/set-state-in-effect
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
						<Suspense fallback={<Spinner />}>
							<ReverifyFormFetcher />
						</Suspense>
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

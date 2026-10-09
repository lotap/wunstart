import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer'
import {queryOptions, useQuery, useQueryClient} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {Edit} from 'lucide-react'
import {lazy, useEffect, useState} from 'react'

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
	DrawerTrigger,
} from '#/components/ui/drawer.tsx'
import {FieldGroup} from '#/components/ui/field.tsx'
import {toast} from '#/components/ui/toast.tsx'
import {useHasSudo} from '#/contexts/has-sudo.tsx'
import {useConfiguredAppForm, validateAfterFirstSubmit} from '#/hooks/use-app-form.ts'
import {EmailCredentials, EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'
import {Email} from '#/isomorphic/validators.ts'
import {handleEmailChange} from '#/server-fns/handle-email-change.ts'
import {handleEmailRequestPasscodeForEmailChange} from '#/server-fns/handle-email-request-passcode-for-email-change.ts'
import {handleGetUserEmail} from '#/server-fns/handle-get-user-email.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

import {usePasscodeRequestMutation} from './_hooks.ts'
import {PasscodeForm} from './_passcode-form.tsx'
import {passcodeRequestQueryOptions, userProfileQueryOptions} from './_utils.ts'

const ReverifyDrawer = lazy(() =>
	import('./_reverify-drawer.tsx').then((m) => ({default: m.ReverifyDrawer})),
)

function NewEmailForm({onCodeSent}: {onCodeSent: (email: string) => void}) {
	const handleEmailRequestPasscodeForEmailChangeFn = useServerFn(
		handleEmailRequestPasscodeForEmailChange,
	)

	const form = useConfiguredAppForm({
		defaultValues: {
			email: '',
		},
		onSubmitSchema: EmailCredentials,
		onSubmitTry: async ({email}) => {
			await handleEmailRequestPasscodeForEmailChangeFn({data: {email}})
			onCodeSent(email)
		},
	})

	return (
		<form.AppForm>
			<div className="w-full max-w-sm">
				<div className="mb-3">Enter your new email address</div>

				<form
					className="w-full max-w-sm"
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
								name="email"
								validators={[validateAfterFirstSubmit(Schema.toStandardSchemaV1(Email))]}
							>
								{(field) => <field.EmailField />}
							</form.Field>

							<form.OnSubmitErrors />

							<form.SubmitButton label="Send Code" labelWhileSubmitting="Sending" />
						</FieldGroup>
					</FieldGroup>
				</form>
			</div>
		</form.AppForm>
	)
}

function VerifyNewEmailForm({
	newEmail,
	closeEmailChangeDrawer,
}: {
	newEmail: string
	closeEmailChangeDrawer?: () => void
}) {
	const handleEmailRequestPasscodeForEmailChangeFn = useServerFn(
		handleEmailRequestPasscodeForEmailChange,
	)
	const handleEmailChangeFn = useServerFn(handleEmailChange)
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const queryClient = useQueryClient()

	const requestServerFn = () =>
		handleEmailRequestPasscodeForEmailChangeFn({data: {email: newEmail}})

	const _passcodeRequestQueryOptions = passcodeRequestQueryOptions({
		serverFn: requestServerFn,
		email: newEmail,
		intent: 'reverify',
	})

	const {mutatePasscodeRequest, passcodeRequestIsPending} = usePasscodeRequestMutation({
		serverFn: requestServerFn,
		invalidationKey: _passcodeRequestQueryOptions.queryKey,
	})

	return (
		<div className="w-full max-w-sm">
			<div className="mb-3 text-center">
				We sent a 6-digit code to <strong>{newEmail}</strong>
			</div>

			<PasscodeForm
				onSubmitSchema={EmailPasscodeCredentials}
				onSubmitTry={async ({passcode}) => {
					await handleEmailChangeFn({data: {email: newEmail, passcode}})
					await queryClient.invalidateQueries({
						queryKey: userProfileQueryOptions({serverFn: handleGetUserProfileFn}).queryKey,
					})
					if (closeEmailChangeDrawer) closeEmailChangeDrawer()
					toast.add({
						type: 'success',
						title: 'Email Updated',
					})
				}}
				email={newEmail}
				passcodeRequestQueryOptions={_passcodeRequestQueryOptions}
				mutatePasscodeRequest={mutatePasscodeRequest}
				mutatePasscodeRequestIsPending={passcodeRequestIsPending}
			/>
		</div>
	)
}

/**
 * The full email address, sudo-gated. Never shares the profile cache key, and
 * the caller must enable it only under sudo and drop it when sudo lapses — a
 * stale full address in cache would defeat the profile masking. Single-use,
 * so it lives with its consumer instead of the shared query options
 */
const userEmailQueryOptions = ({
	serverFn,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleGetUserEmail>>
}) =>
	queryOptions({
		queryKey: ['userEmail'],
		queryFn: () => serverFn(),
	})

export function ChangeEmailForm({closeEmailChangeDrawer}: {closeEmailChangeDrawer?: () => void}) {
	const handleGetUserEmailFn = useServerFn(handleGetUserEmail)

	const queryClient = useQueryClient()

	const {hasSudo} = useHasSudo()

	/**
	 * The only privileged path to the full address, fetched only under sudo.
	 * The profile endpoint carries just the masked form
	 */
	const {data: userEmail} = useQuery({
		...userEmailQueryOptions({serverFn: handleGetUserEmailFn}),
		enabled: hasSudo,
	})

	useEffect(() => {
		/** Drop the privileged address the moment sudo lapses so it never lingers in cache */
		if (!hasSudo)
			queryClient.removeQueries({
				queryKey: userEmailQueryOptions({serverFn: handleGetUserEmailFn}).queryKey,
			})
	}, [hasSudo, queryClient, handleGetUserEmailFn])

	const [newEmail, setNewEmail] = useState<string | null>(null)

	/**
	 * Always set the initial value to false so it renders closed
	 * This provides a base so that the animate-in can function properly
	 */
	const [reverifyOpen, setReverifyOpen] = useState(false)

	useEffect(() => {
		/** setState in effect is necessary to allow first render to have the drawer closed */
		// oxlint-disable-next-line react/set-state-in-effect react-hooks-js/set-state-in-effect
		if (!hasSudo) setReverifyOpen(true)
	}, [hasSudo])

	if (!hasSudo)
		return (
			// No fallback because it should enter off-screen and animate in
			<AsyncBoundary>
				<ReverifyDrawer
					open={reverifyOpen}
					setOpen={setReverifyOpen}
					closeCallerDrawer={closeEmailChangeDrawer}
				/>
				{!reverifyOpen && (
					<div className="flex flex-col gap-3 text-center">
						<p>You must reverify your account before you can change your email</p>
						<Button
							variant="outline"
							onClick={() => {
								setReverifyOpen(true)
							}}
						>
							Reverify
						</Button>
					</div>
				)}
			</AsyncBoundary>
		)

	if (newEmail)
		return (
			<VerifyNewEmailForm newEmail={newEmail} closeEmailChangeDrawer={closeEmailChangeDrawer} />
		)

	return (
		<>
			{userEmail?.email && (
				<p className="mb-16 text-center text-muted-foreground">
					<strong className="text-xl">{userEmail.email}</strong>
				</p>
			)}
			<NewEmailForm onCodeSent={setNewEmail} />
		</>
	)
}

export function EmailChangeDrawer({triggerClassName}: {triggerClassName?: string}) {
	const [open, setOpen] = useState(false)
	return (
		<Drawer showSwipeHandle open={open} onOpenChange={setOpen}>
			<DrawerTrigger
				render={
					<Button
						size="icon-sm"
						variant="secondary"
						className={triggerClassName}
						aria-label="Change email"
					/>
				}
			>
				<Edit />
			</DrawerTrigger>
			<DrawerPrimitive.VirtualKeyboardProvider>
				<DrawerContent className="min-h-2/3">
					<DrawerHeader>
						<DrawerTitle className="text-4xl font-bold">Update Your Email</DrawerTitle>
						<DrawerDescription>We’ll send a code to verify the new address</DrawerDescription>
					</DrawerHeader>
					<div className="flex grow flex-col items-center justify-center p-4">
						<ChangeEmailForm
							closeEmailChangeDrawer={() => {
								setOpen(false)
							}}
						/>
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

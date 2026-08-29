import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer'
import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {Schema} from 'effect'
import {lazy, Suspense, useEffect, useState} from 'react'

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
import {PasswordChangeCredentials} from '#/isomorphic/validations/auth.ts'
import {StrongPassword} from '#/isomorphic/validators.ts'
import {handlePasswordChange} from '#/server-fns/handle-password-change.ts'

const ReverifyDrawer = lazy(() =>
	import('./_reverify-drawer.tsx').then((m) => ({default: m.ReverifyDrawer})),
)

export function ChangePasswordForm({
	closePasswordChangeDrawer,
	showSignOutAllSessions = false,
}: {
	closePasswordChangeDrawer?: () => void
	showSignOutAllSessions?: boolean
}) {
	const handlePasswordChangeFn = useServerFn(handlePasswordChange)

	const {hasSudo} = useHasSudo()

	const router = useRouter()

	const form = useConfiguredAppForm({
		defaultValues: {
			password: '',
			signOutAllSessions: false,
		},
		onSubmitSchema: PasswordChangeCredentials,
		onSubmitTry: async ({password, signOutAllSessions}) => {
			await handlePasswordChangeFn({data: {password, signOutAllSessions}})
			/** Every session was archived, including this one, so refresh app state */
			if (signOutAllSessions) await router.invalidate()
			if (closePasswordChangeDrawer) closePasswordChangeDrawer()
			toast.add({
				type: 'success',
				title: 'Password Updated',
				description: signOutAllSessions ? 'You have been signed out of all sessions' : undefined,
			})
		},
	})

	/**
	 * Always set the initial value to false so it renders closed
	 * This provides a base so that the animate-in can function properly
	 */
	const [reverifyOpen, setReverifyOpen] = useState(false)

	useEffect(() => {
		/** setState in effect is necessary to allow first render to have the drawer closed */
		// oxlint-disable-next-line react/set-state-in-effect
		if (!hasSudo) setReverifyOpen(true)
	}, [hasSudo])

	if (!hasSudo)
		return (
			<Suspense>
				<ReverifyDrawer
					open={reverifyOpen}
					setOpen={setReverifyOpen}
					closeCallerDrawer={closePasswordChangeDrawer}
				/>
				{!reverifyOpen && (
					<div className="flex flex-col gap-3 text-center">
						<p>You must reverify your account before you can change your password</p>
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
			</Suspense>
		)

	return (
		<form.AppForm>
			<div className="w-full max-w-sm">
				<div className="mb-3">Set a new password</div>

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
								name="password"
								validators={[validateAfterFirstSubmit(Schema.toStandardSchemaV1(StrongPassword))]}
							>
								{(field) => <field.PasswordField />}
							</form.Field>

							{showSignOutAllSessions && (
								<form.Field name="signOutAllSessions">
									{(field) => (
										<field.CheckboxField
											label="Sign out all sessions"
											description="Ends every signed-in session, including this device. You will need to sign in again."
										/>
									)}
								</form.Field>
							)}

							<form.OnSubmitErrors />

							<form.SubmitButton label="Set Password" labelWhileSubmitting="Updating" />
						</FieldGroup>
					</FieldGroup>
				</form>
			</div>
		</form.AppForm>
	)
}

export function PasswordChangeDrawer() {
	const [open, setOpen] = useState(false)
	return (
		<Drawer showSwipeHandle open={open} onOpenChange={setOpen}>
			<DrawerTrigger render={<Button variant="outline" />}>Change Password</DrawerTrigger>
			<DrawerPrimitive.VirtualKeyboardProvider>
				<DrawerContent className="min-h-2/3">
					<DrawerHeader>
						<DrawerTitle className="text-4xl font-bold">Update Your Password</DrawerTitle>
						<DrawerDescription>Changes will take effect immediately</DrawerDescription>
					</DrawerHeader>
					<div className="flex grow flex-col items-center justify-center p-4">
						<ChangePasswordForm
							showSignOutAllSessions
							closePasswordChangeDrawer={() => {
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

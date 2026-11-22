import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer'
import {useSelector} from '@tanstack/react-form'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {lazy, useEffect, useState} from 'react'

import {AsyncBoundary} from '#/components/global/async-boundary.tsx'
import {Button, type ButtonProps} from '#/components/ui/button.tsx'
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
import {checkPasswordStrength, loadZxcvbn} from '#/isomorphic/password-strength.ts'
import {PasswordChangeCredentials} from '#/isomorphic/validations/auth.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'
import {handlePasswordChange} from '#/server-fns/handle-password-change.ts'

import {
	type PasswordStrengthContext,
	useDeadSessionRecovery,
	usePasswordStrength,
} from './_hooks.ts'
import {clearIdentityCache, userProfileQueryOptions} from './identity-cache.ts'

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

	const queryClient = useQueryClient()

	const recoverDeadSession = useDeadSessionRecovery()

	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {data: profile} = useQuery(userProfileQueryOptions({serverFn: handleGetUserProfileFn}))

	/**
	 * Client-side identity context for zxcvbn. The profile email is masked, so
	 * this is best-effort only; the server check is authoritative. Add new
	 * non-sensitive profile identity fields here and to `PasswordStrengthContext`
	 */
	const strengthContext = {email: profile?.email} satisfies PasswordStrengthContext

	const strengthUserInputs = Object.values(strengthContext).filter(
		(value): value is string => value !== undefined,
	)

	/**
	 * The zxcvbn dictionaries load lazily on first check, so warm them up while
	 * the user is still typing instead of stalling the first validation
	 */
	useEffect(() => {
		void loadZxcvbn()
	}, [])

	const form = useConfiguredAppForm({
		defaultValues: {
			password: '',
			signOutAllSessions: false,
		},
		onSubmitSchema: PasswordChangeCredentials,
		onSubmitTry: async ({password, signOutAllSessions}) => {
			try {
				await handlePasswordChangeFn({data: {password, signOutAllSessions}})

				/** Every session was archived, including this one, so refresh app state */
				if (signOutAllSessions) {
					clearIdentityCache(queryClient)
					await router.invalidate()
				}

				if (closePasswordChangeDrawer) closePasswordChangeDrawer()
				toast.add({
					type: 'success',
					title: 'Password updated',
					description: signOutAllSessions ? 'You have been signed out of all sessions' : undefined,
				})
			} catch (error) {
				recoverDeadSession(error)
				throw error
			}
		},
	})

	const password = useSelector(form.atom, (state) => state.values.password)

	/** One settled zxcvbn result drives both the submit gate and the meter, so they cannot disagree */
	const strength = usePasswordStrength(password, strengthContext)

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
			</AsyncBoundary>
		)

	return (
		<form.AppForm>
			<div className="w-full max-w-sm">
				<div className="mb-3">Set a new password</div>

				<form
					className="w-full max-w-sm"
					aria-label="Change password"
					noValidate
					onSubmit={(e) => {
						e.preventDefault()
						e.stopPropagation()
						void form.handleSubmit()
					}}
					action="#"
				>
					<FieldGroup>
						<form.Field
							name="password"
							validators={[
								validateAfterFirstSubmit(async ({value}: {value: string}) => {
									/**
									 * Async because the zxcvbn dictionaries lazy-load. The
									 * client context is the masked profile email; the server
									 * checks the real address
									 */
									const {isStrong, message} = await checkPasswordStrength(value, strengthUserInputs)

									if (isStrong) return undefined

									return message
								}),
							]}
						>
							{(field) => (
								<field.PasswordField
									formId="password-change"
									strength={strength}
									autoComplete="new-password"
								/>
							)}
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

						{/**
						 * Disabled until the password is strong; a disabled default button
						 * also blocks implicit Enter submits. The validator covers only
						 * the debounce race, and the server re-check stays authoritative
						 */}
						<form.SubmitButton
							label="Set password"
							labelWhileSubmitting="Updating"
							buttonProps={{disabled: !strength?.isStrong}}
						/>
					</FieldGroup>
				</form>
			</div>
		</form.AppForm>
	)
}

export function PasswordChangeDrawer({
	triggerClassName,
	triggerVariant = 'outline',
}: {
	triggerClassName?: string
	triggerVariant?: ButtonProps['variant']
}) {
	const [open, setOpen] = useState(false)

	return (
		<Drawer showSwipeHandle open={open} onOpenChange={setOpen}>
			<DrawerTrigger render={<Button variant={triggerVariant} className={triggerClassName} />}>
				Change password
			</DrawerTrigger>
			<DrawerPrimitive.VirtualKeyboardProvider>
				<DrawerContent className="min-h-2/3">
					<DrawerHeader>
						<DrawerTitle className="text-4xl font-bold">Update your password</DrawerTitle>
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

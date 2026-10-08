import {useRouter} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {lazy, useEffect, useState} from 'react'

import {AsyncBoundary} from '#/components/async-boundary.tsx'
import {Button} from '#/components/ui/button.tsx'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from '#/components/ui/drawer.tsx'
import {Spinner} from '#/components/ui/spinner.tsx'
import {toast} from '#/components/ui/toast.tsx'
import {useHasSudo} from '#/contexts/has-sudo.tsx'
import {handleRemoveUser} from '#/server-fns/handle-remove-user.ts'

const ReverifyDrawer = lazy(() =>
	import('./_reverify-drawer.tsx').then((m) => ({default: m.ReverifyDrawer})),
)

function ConfirmRemoval({closeRemoveAccountDrawer}: {closeRemoveAccountDrawer?: () => void}) {
	const handleRemoveUserFn = useServerFn(handleRemoveUser)
	const router = useRouter()

	const {hasSudo} = useHasSudo()

	const [isRemoving, setIsRemoving] = useState(false)

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
			// No fallback because it should enter off-screen and animate in
			<AsyncBoundary>
				<ReverifyDrawer
					open={reverifyOpen}
					setOpen={setReverifyOpen}
					closeCallerDrawer={closeRemoveAccountDrawer}
				/>
				{!reverifyOpen && (
					<div className="flex flex-col gap-4 text-center">
						<p>You must reverify your account before you can remove it</p>
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
		<div className="flex grow flex-col items-center justify-center p-4">
			<div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
				<p>This will permanently remove your account and sign you out on&nbsp;all&nbsp;devices.</p>
				<p>
					<strong>
						Your account data will be archived and this action cannot&nbsp;be&nbsp;undone.
					</strong>
				</p>

				<div className="mt-4 flex w-full grid-cols-2 flex-col gap-4 sm:grid">
					<Button
						variant="destructive"
						size="lg"
						className="w-full sm:order-2"
						disabled={isRemoving}
						onClick={async () => {
							setIsRemoving(true)
							try {
								await handleRemoveUserFn()
								/** The account is gone, so leave the protected area before refreshing auth state */
								await router.navigate({to: '/', replace: true})
								await router.invalidate()
								toast.add({title: 'Your account has been removed', type: 'success'})
							} catch (error) {
								setIsRemoving(false)
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
						{isRemoving ? 'Removing…' : 'Remove My Account'}
						{isRemoving && <Spinner data-icon="inline-end" />}
					</Button>

					<DrawerClose
						render={
							<Button
								variant="outline"
								size="lg"
								className="w-full text-muted-foreground sm:order-1"
							/>
						}
						disabled={isRemoving}
					>
						Cancel
					</DrawerClose>
				</div>
			</div>
		</div>
	)
}

export function RemoveAccountDrawer({triggerClassName}: {triggerClassName?: string}) {
	const [open, setOpen] = useState(false)
	return (
		<Drawer showSwipeHandle open={open} onOpenChange={setOpen}>
			<DrawerTrigger render={<Button variant="destructive" className={triggerClassName} />}>
				Remove Account
			</DrawerTrigger>
			<DrawerContent className="min-h-2/3">
				<DrawerHeader>
					<DrawerTitle className="text-4xl font-bold">Remove Your Account</DrawerTitle>
					<DrawerDescription>Permanently lose access</DrawerDescription>
				</DrawerHeader>
				{/* <div className="flex grow flex-col items-center justify-center p-4"> */}
				<ConfirmRemoval
					closeRemoveAccountDrawer={() => {
						setOpen(false)
					}}
				/>
				{/* </div> */}
			</DrawerContent>
		</Drawer>
	)
}

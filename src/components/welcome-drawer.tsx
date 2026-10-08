import {Drawer as DrawerPrimitive} from '@base-ui/react/drawer'
import {useRouter} from '@tanstack/react-router'
import {useEffect, useState} from 'react'

import {ChangePasswordForm} from './auth/password-change.tsx'
import {Button} from './ui/button.tsx'
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from './ui/drawer.tsx'

export function WelcomeDrawer() {
	const router = useRouter()
	const [open, setOpen] = useState(false)

	// oxlint-disable-next-line react-doctor/rendering-hydration-no-flicker
	useEffect(() => {
		/** setting false above then open here makes the animate-in of the drawer work when it loads in */
		// oxlint-disable-next-line react/set-state-in-effect react-hooks-js/set-state-in-effect
		setOpen(true)
	}, [])

	return (
		<Drawer
			showSwipeHandle
			open={open}
			onOpenChange={(_open) => {
				setOpen(_open)
				void router.navigate({to: '/', state: {welcome: false}})
			}}
		>
			<DrawerPrimitive.VirtualKeyboardProvider>
				<DrawerContent className="min-h-2/3">
					<DrawerHeader>
						<DrawerTitle className="text-4xl font-bold">Welcome to the&nbsp;club!</DrawerTitle>
						<DrawerDescription>
							Set up the basics to get the most out of your account
						</DrawerDescription>
					</DrawerHeader>
					<div className="flex grow flex-col items-center justify-center p-4">
						<ChangePasswordForm />
					</div>
					<DrawerFooter>
						<p className="text-center text-muted-foreground">
							You can change these options at any time from the settings page.
						</p>
						<DrawerClose
							render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}
						>
							Skip for Now
						</DrawerClose>
					</DrawerFooter>
				</DrawerContent>
			</DrawerPrimitive.VirtualKeyboardProvider>
		</Drawer>
	)
}

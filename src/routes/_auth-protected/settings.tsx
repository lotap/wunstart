import {createFileRoute} from '@tanstack/react-router'

import {PasswordChangeDrawer} from '#/components/auth/password-change.tsx'
import {RemoveAccountDrawer} from '#/components/auth/remove-account.tsx'
import {Button} from '#/components/ui/button.tsx'
import {useSignOutAll} from '#/hooks/use-sign-out-all.ts'
import {useSignOut} from '#/hooks/use-sign-out.ts'

export const Route = createFileRoute('/_auth-protected/settings')({
	component: RouteComponent,
})

function RouteComponent() {
	const {auth} = Route.useRouteContext()
	const signOut = useSignOut()
	const signOutAll = useSignOutAll()

	const {userId} = auth

	return (
		<div>
			Hello {userId}!
			<br />
			<Button onClick={async () => await signOut()}>Sign Out</Button>
			<br />
			<Button onClick={async () => await signOutAll()}>Sign Out All</Button>
			<br />
			<PasswordChangeDrawer />
			<br />
			<RemoveAccountDrawer />
		</div>
	)
}

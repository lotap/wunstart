import {queryOptions, useQuery} from '@tanstack/react-query'
import {createFileRoute} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {PasswordChangeDrawer} from '#/components/auth/password-change.tsx'
import {RemoveAccountDrawer} from '#/components/auth/remove-account.tsx'
import {Button} from '#/components/ui/button.tsx'
import {useSignOutAll} from '#/hooks/use-sign-out-all.ts'
import {useSignOut} from '#/hooks/use-sign-out.ts'
import {handleGetSessions} from '#/server-fns/handle-get-sessions.ts'

export const Route = createFileRoute('/_auth-protected/settings')({
	component: RouteComponent,
})

function SessionsList() {
	const handleGetSessionsFn = useServerFn(handleGetSessions)

	const sessionsQueryOptions = queryOptions({
		queryKey: ['sessions'],
		queryFn: () => handleGetSessionsFn(),
	})

	const {isPending, error, data: sessions} = useQuery(sessionsQueryOptions)

	if (isPending) return <p>Loading sessions…</p>
	if (error) return <p>Couldn’t load your sessions. Please try again.</p>

	return (
		<ul>
			{sessions.map((session) => (
				<li key={session.id}>
					Signed in {session.createdAt.toLocaleString()} · expires{' '}
					{session.expiresAt.toLocaleString()}
					<p>IP: {session.ipAddress ?? 'Unknown'}</p>
					{session.device && <p>Device: {session.device}</p>}
					{session.location && <p>Location: {session.location}</p>}
				</li>
			))}
		</ul>
	)
}

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
			<br />
			<h2>Your sessions</h2>
			<SessionsList />
		</div>
	)
}

import {queryOptions, useQuery} from '@tanstack/react-query'
import {createFileRoute} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {userProfileQueryOptions} from '#/components/auth/_utils.ts'
import {PasswordChangeDrawer} from '#/components/auth/password-change.tsx'
import {RemoveAccountDrawer} from '#/components/auth/remove-account.tsx'
import {ErrorBoundary} from '#/components/error-boundary.tsx'
import {Button} from '#/components/ui/button.tsx'
import {useSignOutAll} from '#/hooks/use-sign-out-all.ts'
import {useSignOut} from '#/hooks/use-sign-out.ts'
import {handleGetSessions} from '#/server-fns/handle-get-sessions.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

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

	if (isPending)
		return (
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
			<p role="status" aria-busy="true">
				Loading sessions…
			</p>
		)
	if (error) return <p role="alert">Couldn’t load your sessions. Please try again.</p>

	return (
		<ul>
			{sessions.map((session) => {
				const createdAtString = session.createdAt.toLocaleString()
				/**
				 * ms-precision timestamp as key: rows are stateless and the list is tiny,
				 * so the only failure mode (two sign-ins within the same millisecond —
				 * already guarded by the disabled submit button) is a console warning
				 */
				return (
					<li key={session.createdAt.getTime()}>
						<p>Signed in: {createdAtString}</p>
						<p>IP: {session.ipAddress ?? 'Unknown'}</p>
						{session.device && <p>Device: {session.device}</p>}
						{session.location && <p>Location: {session.location}</p>}
					</li>
				)
			})}
		</ul>
	)
}

function RouteComponent() {
	const signOut = useSignOut()
	const signOutAll = useSignOutAll()

	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {isPending, data: profile} = useQuery(
		userProfileQueryOptions({serverFn: handleGetUserProfileFn}),
	)

	return (
		<div>
			Hello {isPending ? '…' : (profile?.email ?? '')}!
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
			<ErrorBoundary fallback={<p>Couldn’t render your sessions. Please try again.</p>}>
				<SessionsList />
			</ErrorBoundary>
		</div>
	)
}

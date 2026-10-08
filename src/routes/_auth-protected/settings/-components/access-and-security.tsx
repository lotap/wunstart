import {queryOptions, useQuery} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'

import {PasswordChangeDrawer} from '#/components/auth/password-change.tsx'
import {RemoveAccountDrawer} from '#/components/auth/remove-account.tsx'
import {ErrorBoundary} from '#/components/error-boundary.tsx'
import {Button} from '#/components/ui/button.tsx'
import {Spinner} from '#/components/ui/spinner.tsx'
import {useSignOutAll} from '#/hooks/use-sign-out-all.ts'
import {useSignOut} from '#/hooks/use-sign-out.ts'
import {handleGetSessions} from '#/server-fns/handle-get-sessions.ts'

function SessionsList() {
	const handleGetSessionsFn = useServerFn(handleGetSessions)

	const sessionsQueryOptions = queryOptions({
		queryKey: ['sessions'],
		queryFn: () => handleGetSessionsFn(),
		/**
		 * Locale-dependent display text is derived as query data (select),
		 * not formatted during render
		 */
		select: (sessions) =>
			sessions.map((session) => ({
				...session,
				createdAtString: session.createdAt.toLocaleString(),
			})),
	})

	const {isPending, error, data: sessions} = useQuery(sessionsQueryOptions)

	if (isPending)
		return (
			<p
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
				role="status"
				aria-busy="true"
				className="flex items-center gap-1 rounded-lg border px-4 py-5.75 text-sm text-muted-foreground"
			>
				Loading sessions <Spinner />
			</p>
		)
	if (error) return <p role="alert">Couldn’t load your sessions. Please try again.</p>

	return (
		<ul className="flex flex-col divide-y rounded-lg border">
			{sessions.map((session) => {
				/**
				 * ms-precision timestamp as key: rows are stateless and the list is tiny,
				 * so the only failure mode (two sign-ins within the same millisecond —
				 * already guarded by the disabled submit button) is a console warning
				 */
				return (
					<li key={session.createdAt.getTime()} className="flex flex-col gap-0.5 p-3">
						<p className="text-sm font-medium">Signed in {session.createdAtString}</p>
						<p className="text-sm text-muted-foreground">
							{[session.device, session.location, session.ipAddress ?? 'Unknown IP']
								.filter(Boolean)
								.join(' · ')}
						</p>
					</li>
				)
			})}
		</ul>
	)
}

export function AccessAndSecurity() {
	const signOut = useSignOut()
	const signOutAll = useSignOutAll()

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-4">
				<PasswordChangeDrawer triggerClassName="w-fit" />
			</section>
			<section className="flex flex-col gap-4">
				<h3 className="text-base text-muted-foreground">Sessions</h3>
				<div className="flex gap-2">
					<Button variant="outline" onClick={async () => await signOut()} className="w-fit">
						Sign Out
					</Button>
					<Button variant="outline" onClick={async () => await signOutAll()} className="w-fit">
						Sign Out All
					</Button>
				</div>
				<ErrorBoundary fallback={<p>Couldn’t render your sessions. Please try again.</p>}>
					<SessionsList />
				</ErrorBoundary>
			</section>
			<section className="flex flex-col gap-4">
				<h3 className="text-base text-muted-foreground">Danger Zone</h3>
				<RemoveAccountDrawer triggerClassName="w-fit" />
			</section>
		</div>
	)
}

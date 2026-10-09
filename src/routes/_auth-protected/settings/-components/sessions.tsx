import {queryOptions, useQuery} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import type {ReactNode} from 'react'

import {ErrorBoundary} from '#/components/error-boundary.tsx'
import {Button} from '#/components/ui/button.tsx'
import {Spinner} from '#/components/ui/spinner.tsx'
import {useSignOutAll} from '#/hooks/use-sign-out-all.ts'
import {useSignOut} from '#/hooks/use-sign-out.ts'
import {handleGetSessions} from '#/server-fns/handle-get-sessions.ts'

type SessionDisplay = {
	createdAt: Date
	createdAtString: string
	device: string | null
	location: string | null
	ipAddress: string | null
	isCurrent: boolean
}

function SessionText({session}: {session: SessionDisplay}) {
	return (
		<>
			{session.isCurrent ? <p className="text-sm text-muted-foreground">Current session</p> : null}
			<p className="text-sm font-medium">Signed in {session.createdAtString}</p>
			<p className="text-sm text-muted-foreground">
				{[session.device, session.location, session.ipAddress ?? 'Unknown IP']
					.filter(Boolean)
					.join(' · ')}
			</p>
		</>
	)
}

function SessionItem({session}: {session: SessionDisplay}) {
	return (
		<li className="flex flex-col gap-0.5 p-4">
			<SessionText session={session} />
		</li>
	)
}

function SignOutButton() {
	const signOut = useSignOut()

	return (
		<Button variant="outline" onClick={async () => await signOut()} className="w-fit">
			Sign Out
		</Button>
	)
}

function CurrentBox({children}: {children: ReactNode}) {
	return (
		<div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
			{children}
		</div>
	)
}

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
			<CurrentBox>
				{/* min-h matches the three-line current-session content below so the box never changes height */}
				<p
					// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
					role="status"
					aria-busy="true"
					className="flex min-h-16 items-center gap-1 text-sm text-muted-foreground"
				>
					Loading sessions <Spinner />
				</p>
				<SignOutButton />
			</CurrentBox>
		)

	if (error)
		return (
			<CurrentBox>
				<p role="alert" className="flex min-h-16 items-center text-sm text-muted-foreground">
					Couldn’t load your sessions. Please try again.
				</p>
				<SignOutButton />
			</CurrentBox>
		)

	const current = sessions.find((session) => session.isCurrent)
	const others = sessions.filter((session) => !session.isCurrent)

	/** Every session is gone (e.g. a remote sign-out-all): nothing to list or leave */
	if (!sessions.length) return <p className="text-sm text-muted-foreground">No active sessions.</p>

	/** Fail-closed: current unknown, keep the single combined list */
	if (!current)
		return (
			<div className="flex flex-col gap-2">
				<ul className="flex flex-col divide-y rounded-lg border">
					{sessions.map((session) => (
						/** ms-precision timestamp as key: rows are stateless and the list is tiny */
						<SessionItem key={session.createdAt.getTime()} session={session} />
					))}
				</ul>
				<SignOutButton />
			</div>
		)

	return (
		<div className="flex flex-col gap-2">
			<CurrentBox>
				<div className="flex min-h-16 flex-col justify-center gap-0.5">
					<SessionText session={current} />
				</div>
				<SignOutButton />
			</CurrentBox>
			{others.length ? (
				<ul className="flex flex-col divide-y rounded-lg border">
					{others.map((session) => (
						/** ms-precision timestamp as key: rows are stateless and the list is tiny */
						<SessionItem key={session.createdAt.getTime()} session={session} />
					))}
				</ul>
			) : null}
		</div>
	)
}

export function SessionsSection() {
	const signOutAll = useSignOutAll()

	return (
		<section className="flex flex-col gap-4">
			<h3 className="text-sm font-medium text-muted-foreground">Sessions</h3>
			<div className="flex flex-col gap-2">
				<ErrorBoundary fallback={<p>Couldn’t render your sessions. Please try again.</p>}>
					<SessionsList />
				</ErrorBoundary>
				{/** Extra top margin as a deliberate break before the sign-out-all action */}
				<div className="mt-2 flex flex-row flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-4">
					<Button variant="outline" onClick={async () => await signOutAll()} className="w-fit">
						Sign Out All
					</Button>
					<p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
						Ends every session, including this device. You will need to sign in again.
					</p>
				</div>
			</div>
		</section>
	)
}

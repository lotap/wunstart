import {queryOptions, useQuery} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import type {ReactNode} from 'react'

import {ErrorBoundary} from '#/components/error-boundary.tsx'
import {Badge} from '#/components/ui/badge.tsx'
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
			<p className="flex items-center gap-2 text-sm font-medium">
				Signed in {session.createdAtString}
				{session.isCurrent ? (
					<Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
						Current Session
					</Badge>
				) : null}
			</p>
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
		<Button variant="secondary" onClick={async () => await signOut()} className="sm:w-fit">
			Sign Out
		</Button>
	)
}

function CurrentBox({children}: {children: ReactNode}) {
	return (
		<div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
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
				{/* min-h matches the two-line session content below so the box never changes height */}
				<p
					// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
					role="status"
					aria-busy="true"
					className="flex min-h-10.5 items-center gap-1 text-sm text-muted-foreground"
				>
					Loading sessions <Spinner />
				</p>
				<SignOutButton />
			</CurrentBox>
		)

	if (error)
		return (
			<CurrentBox>
				<p role="alert" className="flex min-h-10.5 items-center text-sm text-muted-foreground">
					Couldn’t load your sessions. Please try again.
				</p>
				<SignOutButton />
			</CurrentBox>
		)

	const current = sessions.find((session) => session.isCurrent)
	const others = sessions.filter((session) => !session.isCurrent)

	/** Fail-closed: current unknown, keep the single combined list */
	if (!current)
		return (
			<div className="flex flex-col gap-2">
				<ul className="flex flex-col divide-y rounded-lg border bg-card">
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
				<div className="flex min-h-10.5 flex-col justify-center gap-0.5">
					<SessionText session={current} />
				</div>
				<SignOutButton />
			</CurrentBox>
			{others.length ? (
				<ul className="flex flex-col divide-y rounded-lg border bg-card">
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
			<h3 className="text-base text-muted-foreground">Sessions</h3>
			<div className="flex flex-col gap-2 rounded-lg border bg-muted p-2">
				<ErrorBoundary fallback={<p>Couldn’t render your sessions. Please try again.</p>}>
					<SessionsList />
				</ErrorBoundary>
				<Button variant="outline" onClick={async () => await signOutAll()} className="my-2">
					Sign Out All
				</Button>
			</div>
		</section>
	)
}

import {createFileRoute} from '@tanstack/react-router'
import {lazy} from 'react'

import {AsyncBoundary} from '#/components/async-boundary.tsx'
import {SignUpForm} from '#/components/auth/sign-up-form.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'

const Dashboard = lazy(() =>
	import('#/components/dashboard.tsx').then((m) => ({default: m.Dashboard})),
)

function DashboardFallback() {
	return (
		<div className="flex w-full flex-col gap-2 p-4">
			<Skeleton className="h-7 w-32" />
			<Skeleton className="h-40 w-full" />
		</div>
	)
}

export const Route = createFileRoute('/_auth-dynamic/')({
	component: App,
})

function App() {
	const {auth} = Route.useRouteContext()

	if (auth) {
		return (
			<AsyncBoundary fallback={<DashboardFallback />}>
				<Dashboard />
			</AsyncBoundary>
		)
	}

	return (
		<section className="flex h-full flex-col">
			<h2>Home</h2>
			<p>You can update this page at "/_auth-dynamic/index.tsx"</p>
			<p>When you sign in, though content will to change to a dashboard</p>
			<SignUpForm />
		</section>
	)
}

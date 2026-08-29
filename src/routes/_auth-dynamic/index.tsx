import {createFileRoute} from '@tanstack/react-router'
import {lazy, Suspense} from 'react'

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'

const Dashboard = lazy(() =>
	import('#/components/dashboard.tsx').then((m) => ({default: m.Dashboard})),
)

export const Route = createFileRoute('/_auth-dynamic/')({
	component: App,
})

function App() {
	const {auth} = Route.useRouteContext()

	if (auth) {
		return (
			<Suspense>
				<Dashboard />
			</Suspense>
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

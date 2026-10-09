import {createFileRoute} from '@tanstack/react-router'

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'
import {Dashboard} from '#/components/dashboard.tsx'

export const Route = createFileRoute('/_auth-dynamic/')({
	component: App,
})

function App() {
	const {auth} = Route.useRouteContext()

	if (auth) {
		return <Dashboard />
	}

	return (
		<section className="mx-auto max-w-5xl p-2">
			<h2>Home</h2>
			<p>You can update this page at "/_auth-dynamic/index.tsx"</p>
			<p>When you sign in, though content will to change to a dashboard</p>
			<SignUpForm />
		</section>
	)
}

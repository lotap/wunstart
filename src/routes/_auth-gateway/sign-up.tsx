import {createFileRoute} from '@tanstack/react-router'

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'
import {pageMeta} from '#/lib/page-meta.ts'

export const Route = createFileRoute('/_auth-gateway/sign-up')({
	component: App,
	head: () => ({
		meta: pageMeta('Create an account', 'Create your account and start building.'),
	}),
})

function App() {
	return (
		<section className="flex min-h-svh flex-col justify-center">
			<h1 className="sr-only">Sign up</h1>
			<SignUpForm />
		</section>
	)
}

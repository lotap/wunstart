import {createFileRoute} from '@tanstack/react-router'

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'

export const Route = createFileRoute('/_auth-gateway/sign-up')({component: App})

function App() {
	return (
		<section className="flex min-h-svh flex-col justify-center">
			<SignUpForm />
		</section>
	)
}

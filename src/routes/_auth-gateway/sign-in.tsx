import {createFileRoute} from '@tanstack/react-router'

import {SignInForm} from '#/components/auth/sign-in-form.tsx'

export const Route = createFileRoute('/_auth-gateway/sign-in')({component: App})

function App() {
	return (
		<section className="flex h-full flex-col justify-center">
			<div>
				<SignInForm />
			</div>
		</section>
	)
}

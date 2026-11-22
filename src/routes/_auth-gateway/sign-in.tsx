import {createFileRoute} from '@tanstack/react-router'
import {Schema} from 'effect'

import {SignInForm} from '#/components/auth/sign-in-form.tsx'
import {pageMeta} from '#/lib/page-meta.ts'

const SignInSearchSchema = Schema.Struct({
	redirect: Schema.optional(Schema.String),
})

export const Route = createFileRoute('/_auth-gateway/sign-in')({
	validateSearch: Schema.toStandardSchemaV1(SignInSearchSchema),
	component: App,
	head: () => ({
		meta: pageMeta('Sign in', 'Sign in to your account.'),
	}),
})

function App() {
	return (
		<section className="flex min-h-svh flex-col justify-center">
			<h1 className="sr-only">Sign in</h1>
			<div>
				<SignInForm />
			</div>
		</section>
	)
}

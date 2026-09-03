import {createFileRoute} from '@tanstack/react-router'
import {Schema} from 'effect'

import {SignInForm} from '#/components/auth/sign-in-form.tsx'

const SignInSearchSchema = Schema.Struct({
	redirect: Schema.optional(Schema.String),
})

export const Route = createFileRoute('/_auth-gateway/sign-in')({
	validateSearch: Schema.toStandardSchemaV1(SignInSearchSchema),
	component: App,
})

function App() {
	return (
		<section className="flex h-full flex-col justify-center">
			<div>
				<SignInForm />
			</div>
		</section>
	)
}

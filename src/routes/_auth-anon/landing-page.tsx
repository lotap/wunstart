import {createFileRoute} from '@tanstack/react-router'

export const Route = createFileRoute('/_auth-anon/landing-page')({
	component: RouteComponent,
})

function RouteComponent() {
	return <div>Hello "/_auth-anon/landing-page"!</div>
}

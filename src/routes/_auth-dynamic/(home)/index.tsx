import {createFileRoute} from '@tanstack/react-router'

import {AnonHome} from './-components/anon/home.tsx'
import {Dashboard} from './-components/dashboard/dashboard.tsx'

export const Route = createFileRoute('/_auth-dynamic/(home)/')({
	component: Home,
})

function Home() {
	const {auth} = Route.useRouteContext()

	return auth ? <Dashboard /> : <AnonHome />
}

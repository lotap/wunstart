import {createFileRoute, Outlet} from '@tanstack/react-router'

export const Route = createFileRoute('/_dev/status-pages')({
	component: StatusPages,
})

function StatusPages() {
	return <Outlet />
}

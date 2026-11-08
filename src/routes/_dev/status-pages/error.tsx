import {createFileRoute} from '@tanstack/react-router'

import {RouteError} from '#/components/global/status-pages/route-error.tsx'

const previewError = new Error(
	'Preview error: the route loader could not load its data. This is the dev-only detail block.',
)

export const Route = createFileRoute('/_dev/status-pages/error')({
	head: () => ({
		meta: [{title: 'Error preview | wunstart'}, {name: 'robots', content: 'noindex'}],
	}),
	component: ErrorPreview,
})

function ErrorPreview() {
	return <RouteError error={previewError} reset={() => {}} />
}

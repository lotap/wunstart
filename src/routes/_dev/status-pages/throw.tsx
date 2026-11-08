import {createFileRoute} from '@tanstack/react-router'

export const Route = createFileRoute('/_dev/status-pages/throw')({
	loader: () => {
		throw new Error('Preview error from a route loader. The error boundary caught it.')
	},
})

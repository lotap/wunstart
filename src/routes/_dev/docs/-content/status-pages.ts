/** Files involved in route-level 404 and error pages. */
export const statusPageFiles = [
	{
		name: 'src/components/global/status-pages/_status-page-frame.tsx',
		description:
			'Shared full-viewport frame: content position, mono status numeral, and footer spacing.',
	},
	{
		name: 'src/components/global/status-pages/not-found.tsx',
		description: '404 page. Path-specific headline, sanitized path, and Take me home.',
	},
	{
		name: 'src/components/global/status-pages/route-error.tsx',
		description: 'Route error page. Try again, Take me home, and the dev-only error detail.',
	},
	{
		name: 'src/routes/__root.tsx',
		description:
			'Mounts both components, sets their title and noindex metadata, and resolves the 404 audience.',
	},
	{
		name: 'src/routes/_dev/status-pages/',
		description: 'Dev-only previews, plus a route that throws a real error.',
	},
]

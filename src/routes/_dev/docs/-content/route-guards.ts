/** Route groups, ordered from most restricted to least. */
export const routeGuards = [
	{
		name: '_auth-protected',
		description:
			'Requires sign-in. Redirects to /sign-in?redirect= and wraps the route in the sudo provider.',
	},
	{
		name: '_auth-gateway',
		description: 'Sign-in and sign-up only. Signed-in visitors bounce to /.',
	},
	{
		name: '_auth-dynamic',
		description:
			'No redirect. Renders for signed-in and anonymous visitors, adapting to the current identity.',
	},
	{
		name: '_auth-anon',
		description: 'Public. Auth state is irrelevant and no guard or provider wraps the route.',
	},
	{
		name: '_dev',
		description: 'Dev only. Production builds omit the route and its page implementation.',
	},
]

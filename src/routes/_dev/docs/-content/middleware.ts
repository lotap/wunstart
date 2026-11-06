/** Middleware grouped by where it runs. */
export const middlewareLayers = [
	{
		label: 'Request',
		items: [
			{
				name: 'csrfMiddleware',
				description:
					'Server functions only. Rejects a state-changing call without a valid CSRF token.',
			},
			{
				name: 'sanitizeErrors',
				description:
					'Ops errors become 422 responses with their client-safe message. Known server errors pass through; everything else becomes a generic 500 with the cause kept for logs.',
			},
		],
	},
	{
		label: 'Function',
		items: [
			{
				name: 'createRateLimit(150)',
				description:
					'In-memory per-IP limit: 150 requests per minute. Auth functions add a tighter 5-per-minute limit.',
			},
			{
				name: 'verifyAnon',
				description:
					'Runs verifyAuth, verifies the Anon token, or issues a fresh Anon. Auth and Anon status live on the context.',
			},
			{
				name: 'rejectDegradedAuth',
				description:
					'Returns 503 before the handler runs when identity verification degraded. Handlers never see the degraded state.',
			},
		],
	},
]

/** What identity resolution does for each kind of token result. */
export const identityOutcomes = [
	{
		situation: 'Valid access token',
		outcome: 'Authenticated context. The access token is checked without a database round trip.',
	},
	{
		situation: 'Access token missing or invalid, refresh valid',
		outcome: 'The refresh path rotates the session nonce and both token cookies.',
	},
	{
		situation: 'No auth tokens',
		outcome: 'The Anon token is verified, or a fresh Anon is issued with an 8-week cookie.',
	},
	{
		situation: 'AuthTokenError',
		outcome:
			'The token is definitively invalid. Auth cookies are cleared and the request continues as an Anon.',
		mono: true,
	},
	{
		situation: 'RateLimitError',
		outcome: 'Cookies are kept. The request continues as an Anon.',
		mono: true,
	},
	{
		situation: 'Anything else',
		outcome: 'The context is degraded. rejectDegradedAuth returns 503 before the handler runs.',
	},
] satisfies Array<{situation: string; outcome: string; mono?: boolean}>

/** Guards read the verified context; they never re-verify tokens. */
export const guards = [
	{
		name: 'requireAuth',
		description: 'Returns 401 when no verified auth context exists.',
	},
	{
		name: 'requireAnon',
		description: 'Returns 400 when the caller is signed in.',
	},
	{
		name: 'requireAnonRegistered',
		description: 'Requires an Anon that already has a database row.',
	},
]

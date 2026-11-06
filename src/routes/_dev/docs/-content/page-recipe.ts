/** Server function shape shown in the page recipe. */
export const serverFunctionExample = `export const handleGetUserProfile = createServerFn({method: 'GET'})
	.middleware([requireAuth])
	.handler(async ({context: {auth: {userId}, ipAddress}}) => {
		return await runOp({
			op: getUserProfile,
			data: {userId, ipAddress},
			layers: [authLayer, dbLayer],
		})
	})`

/** Query options shape shown in the page recipe. */
export const queryExample = `const handleGetSessionsFn = useServerFn(handleGetSessions)

const sessionsQueryOptions = queryOptions({
	queryKey: ['sessions'],
	queryFn: () => handleGetSessionsFn(),
})`

/** Where the files for a new page go. */
export const pageFiles = [
	{
		name: 'src/routes/<group>/<segment>/route.tsx',
		job: 'The screen and its search validation.',
	},
	{
		name: 'src/routes/<group>/<segment>/-components/',
		job: 'Route-private components. The - prefix keeps them out of the route tree.',
	},
	{
		name: 'src/server-fns/handle-*.ts',
		job: 'The only client-to-server boundary.',
	},
	{
		name: 'src/components/<domain>/',
		job: 'Shared domain components and query options.',
	},
	{
		name: 'src/isomorphic/validations/',
		job: 'Schemas shared by the form and the server function.',
	},
]

/** Existing pages worth reading before writing a new pattern. */
export const exemplars = [
	{
		name: 'src/routes/_auth-protected/settings/-components/sessions.tsx',
		description: 'List query with pending, error, and empty states.',
	},
	{
		name: 'src/routes/_auth-protected/settings/',
		description: 'Page with validated search params and category navigation.',
	},
	{
		name: 'src/components/auth/remove-account.tsx',
		description: 'Sudo-gated mutation with a reverify drawer.',
	},
	{
		name: 'src/components/auth/email-change.tsx',
		description: 'Request, verify, and invalidate a profile query.',
	},
]

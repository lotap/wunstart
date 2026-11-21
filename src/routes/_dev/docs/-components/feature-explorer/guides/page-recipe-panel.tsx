import {CodeBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {
	DocBulletList,
	InlineCode,
	PanelHeader,
	PanelList,
	PanelRow,
	PanelSection,
	Prose,
} from '../../doc-ui.tsx'

/** Server function shape shown in the page recipe. */
const serverFunctionExample = `export const handleGetUserProfile = createServerFn({method: 'GET'})
	.middleware([requireAuth])
	.handler(async ({context: {auth: {userId}, ipAddress}}) => {
		return await runOp({
			op: getUserProfile,
			data: {userId, ipAddress},
			layers: [authLayer, dbLayer],
		})
	})`

/** Query options shape shown in the page recipe. */
const queryExample = `const handleSessionsFn = useServerFn(handleSessionsAndClearDeadSession)

const sessionsQueryOptions = queryOptions({
	queryKey: ['sessions'],
	queryFn: () => handleSessionsFn(),
})`

/** Where the files for a new page go. */
const pageFiles = [
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
const exemplars = [
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

export function PageRecipePanel() {
	return (
		<>
			<PanelHeader
				title="Start a new page"
				description="The route → server function → query → UI path, with the conventions the app already uses."
			/>

			<PanelSection id="page-files" title="Where files go">
				<Prose>
					A page is a route file, a server function, and the components between them. Named pages
					use <InlineCode>&lt;segment&gt;/route.tsx</InlineCode>; index pages use{' '}
					<InlineCode>(&lt;page&gt;)/index.tsx</InlineCode>. Keep route-private code inside the
					route folder.
				</Prose>
				<PanelList>
					{pageFiles.map((file) => (
						<PanelRow key={file.name} label={file.name} width="wide" labelSize="xs">
							{file.job}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelSection id="pick-route-group" title="1. Pick the route group">
				<Prose>
					Choose by who can reach the page: <InlineCode>_auth-protected</InlineCode> requires
					sign-in, <InlineCode>_auth-gateway</InlineCode> is sign-in and sign-up only,{' '}
					<InlineCode>_auth-dynamic</InlineCode> adapts to the current identity,{' '}
					<InlineCode>_auth-anon</InlineCode> is public, and <InlineCode>_dev</InlineCode> is
					available only during development. The folder is the guard; moving a route across groups
					is a security change.
				</Prose>
				<Prose>
					Use <InlineCode>-components/</InlineCode> for route-private files and{' '}
					<InlineCode>_</InlineCode>-prefixed folders for pathless layouts. Never edit{' '}
					<InlineCode>routeTree.gen.ts</InlineCode>; restart the dev server and the Start plugin
					regenerates it.
				</Prose>
			</PanelSection>

			<PanelSection id="add-server-function" title="2. Add the server function">
				<Prose>
					Server functions are the only client-to-server boundary. They validate input, unwrap
					identity from the context, and call one op through <InlineCode>runOp</InlineCode>.
				</Prose>
				<CodeBlock
					code={serverFunctionExample}
					label="Read server function"
					language="typescript"
				/>

				<DocBulletList>
					<li>
						Mutations use <InlineCode>{"createServerFn({method: 'POST'})"}</InlineCode>; reads use{' '}
						<InlineCode>{"createServerFn({method: 'GET'})"}</InlineCode>. Reads that need parameters
						are POST-shaped.
					</li>
					<li>
						Chain <InlineCode>.middleware([...])</InlineCode> and{' '}
						<InlineCode>.validator(...)</InlineCode> before <InlineCode>.handler(...)</InlineCode>.
						Use <InlineCode>rateLimit</InlineCode> on auth functions, then the narrowest guard that
						fits.
					</li>
					<li>
						Validate with <InlineCode>Schema.toStandardSchemaV1(...)</InlineCode>. Schemas live in{' '}
						<InlineCode>src/isomorphic/validations/</InlineCode> and are shared with the client.
					</li>
					<li>
						Identity comes from the verified context, never from client input. Database ids never
						travel client to server; pass a validated slug or search parameter instead.
					</li>
					<li>
						<InlineCode>runOp</InlineCode> provides the layers the op needs. The call fails to
						compile if a required service is missing.
					</li>
				</DocBulletList>
			</PanelSection>

			<PanelSection id="add-query" title="3. Add the query">
				<Prose>
					Reads go through TanStack Query, not ad-hoc fetching in the component. Put shared query
					options beside the feature, or in{' '}
					<InlineCode>src/components/&lt;domain&gt;/_utils.ts</InlineCode>.
				</Prose>
				<CodeBlock code={queryExample} label="Query options" language="typescript" />

				<DocBulletList>
					<li>
						Query keys are <InlineCode>{"['<thing>', ...params]"}</InlineCode>. Use{' '}
						<InlineCode>useQuery</InlineCode> for reads and <InlineCode>useMutation</InlineCode> or
						a feature hook for writes.
					</li>
					<li>
						Keep pending and error states inline inside <InlineCode>ErrorBoundary</InlineCode>. Size
						the <InlineCode>Skeleton</InlineCode> to the expected content so the layout never
						shifts.
					</li>
					<li>
						Use optimistic updates for reversible product mutations. Auth, security, and ban paths
						invalidate and refetch instead.
					</li>
				</DocBulletList>
			</PanelSection>

			<PanelSection id="build-screen" title="4. Build the screen">
				<Prose>
					The app has its own frontend conventions. Follow them instead of adding a parallel
					pattern.
				</Prose>
				<DocBulletList>
					<li>
						React Compiler is on. Do not hand-memoize with <InlineCode>useMemo</InlineCode>,{' '}
						<InlineCode>useCallback</InlineCode>, or <InlineCode>React.memo</InlineCode>.
					</li>
					<li>
						New files use named exports. No <InlineCode>React.FC</InlineCode>, no{' '}
						<InlineCode>{'"use client"'}</InlineCode>.
					</li>
					<li>
						Use the generated primitives in <InlineCode>src/components/ui</InlineCode>; override
						from the caller with <InlineCode>cn()</InlineCode>. Pass{' '}
						<InlineCode>{'render={<Link to=… />}'}</InlineCode> rather than{' '}
						<InlineCode>asChild</InlineCode>.
					</li>
					<li>
						Tailwind v4 tokens live in <InlineCode>src/styles.css</InlineCode>. Use semantic tokens;
						add a token rather than a one-off value.
					</li>
					<li>
						Forms use <InlineCode>useConfiguredAppForm</InlineCode> with the field components in{' '}
						<InlineCode>hooks/use-app-form.ts</InlineCode>. Validation stays silent until the first
						submit, then shows form-level errors.
					</li>
					<li>
						Reads use <InlineCode>AsyncBoundary</InlineCode> or{' '}
						<InlineCode>ErrorBoundary</InlineCode>; mutations use <InlineCode>toast</InlineCode>;
						unknown first-load data gets a sized <InlineCode>Skeleton</InlineCode>.
					</li>
				</DocBulletList>
			</PanelSection>

			<PanelSection id="navigate-page" title="5. Navigate">
				<Prose>
					Internal navigation goes through the router so loaders, search params, and view
					transitions keep working.
				</Prose>
				<DocBulletList>
					<li>
						Internal links use <InlineCode>Link</InlineCode> or{' '}
						<InlineCode>RouterButton</InlineCode>, never <InlineCode>{'<a href>'}</InlineCode> and
						never a <InlineCode>Button</InlineCode> with an onClick navigation.
					</li>
					<li>
						Use <InlineCode>{'router.navigate({to, state})'}</InlineCode> for programmatic
						navigation. Pass <InlineCode>state</InlineCode> for a one-shot post-action message and
						clear it on dismiss.
					</li>
					<li>
						Auth changes end with <InlineCode>router.invalidate()</InlineCode> so the context and
						queries refresh.
					</li>
				</DocBulletList>
			</PanelSection>

			<PanelSection id="verify-page" title="6. Verify">
				<Prose>
					Restart the dev server after adding a route so the route tree regenerates. Then run the
					checks and look at the page.
				</Prose>
				<PanelList>
					<PanelRow label="bun run fmt">
						Formats <InlineCode>src/</InlineCode> and <InlineCode>tools/</InlineCode>.
					</PanelRow>
					<PanelRow label="bun run lint:check">
						Runs oxlint with <InlineCode>--deny-warnings</InlineCode>.
					</PanelRow>
					<PanelRow label="bunx tsc --noEmit">
						The type gate. Dead bindings fail the build.
					</PanelRow>
				</PanelList>

				<Prose>
					Check the page in the browser in both token modes and at mobile width. There is no product
					test suite yet.
				</Prose>
			</PanelSection>

			<PanelSection id="page-exemplars" title="Exemplars">
				<Prose>Read one of these before writing a new pattern from scratch.</Prose>
				<PanelList>
					{exemplars.map((exemplar) => (
						<PanelRow key={exemplar.name} label={exemplar.name} width="wide" labelSize="xs">
							{exemplar.description}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelReferences
				links={[
					{
						label: 'TanStack Start server functions',
						href: 'https://tanstack.com/start/latest/docs/framework/react/guide/server-functions',
					},
					{
						label: 'TanStack Router routing concepts',
						href: 'https://tanstack.com/router/latest/docs/routing/routing-concepts',
					},
					{
						label: 'TanStack Query',
						href: 'https://tanstack.com/query/latest/docs/framework/react/overview',
					},
					{label: 'React', href: 'https://react.dev/'},
					{label: 'shadcn/ui', href: 'https://ui.shadcn.com/'},
					{label: 'Tailwind CSS', href: 'https://tailwindcss.com/'},
				]}
			/>
		</>
	)
}

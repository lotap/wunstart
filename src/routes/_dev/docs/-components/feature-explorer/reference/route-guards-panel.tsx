import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow} from '../../doc-ui.tsx'

/** Route groups, ordered from most restricted to least. */
const routeGuards = [
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

export function RouteGuardsPanel() {
	return (
		<>
			<PanelHeader
				title="Route guards"
				description="A route’s folder is its access rule. Pick the group first; everything else follows."
			/>

			<PanelList className="mt-8">
				{routeGuards.map((guard) => (
					<PanelRow key={guard.name} label={guard.name}>
						{guard.description}
					</PanelRow>
				))}
			</PanelList>

			<p className="mt-4 text-base leading-relaxed text-muted-foreground">
				Moving a route across groups changes who can reach it, so treat it as a security change.
				Each group’s <InlineCode>route.tsx</InlineCode> documents the implied protection.
			</p>

			<PanelReferences
				links={[
					{
						label: 'TanStack Router routing concepts',
						href: 'https://tanstack.com/router/latest/docs/routing/routing-concepts',
					},
				]}
			/>
		</>
	)
}

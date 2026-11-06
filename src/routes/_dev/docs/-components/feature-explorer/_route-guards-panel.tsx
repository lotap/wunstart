import {routeGuards} from '../../-content/route-guards.ts'
import {PanelReferences} from '../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow} from '../doc-ui.tsx'

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

			<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
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

import {createContext, useContext} from 'react'

import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'

import {DocLinkButton} from './doc-ui.tsx'
import type {SidePanelKey} from './feature-explorer/feature-explorer.tsx'

const PanelNavigationContext = createContext<((panel: SidePanelKey) => void) | null>(null)

export function PanelNavigationProvider({
	onSelect,
	children,
}: {
	onSelect: (panel: SidePanelKey) => void
	children: React.ReactNode
}) {
	return (
		<PanelNavigationContext.Provider value={onSelect}>{children}</PanelNavigationContext.Provider>
	)
}

function usePanelNavigation() {
	const onSelect = useContext(PanelNavigationContext)

	if (!onSelect) throw new Error('PanelLink must be used inside PanelNavigationProvider')

	return onSelect
}

export function PanelLink({panel, children}: {panel: SidePanelKey; children: React.ReactNode}) {
	const onSelect = usePanelNavigation()

	return <DocLinkButton onClick={() => onSelect(panel)}>{children}</DocLinkButton>
}

export function PanelReferences({links}: {links: Array<{label: string; href: string}>}) {
	return (
		<section aria-label="References" className="mt-8 border-t pt-5">
			<h5 className="text-sm font-medium">References</h5>
			<ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
				{links.map((link) => (
					<li key={link.href}>
						<ExternalDocLink href={link.href}>{link.label}</ExternalDocLink>
					</li>
				))}
			</ul>
		</section>
	)
}

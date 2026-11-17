import {createContext, useContext} from 'react'

import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'

import {DocLinkButton} from './doc-ui.tsx'
import type {
	GuidePanelKey,
	PanelTarget,
	ReferencePanelKey,
} from './feature-explorer/feature-explorer.tsx'

const PanelNavigationContext = createContext<((target: PanelTarget) => void) | null>(null)

export function PanelNavigationProvider({
	onSelect,
	children,
}: {
	onSelect: (target: PanelTarget) => void
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

type PanelLinkProps =
	| {group?: 'reference'; panel: ReferencePanelKey; children: React.ReactNode}
	| {group: 'guide'; panel: GuidePanelKey; children: React.ReactNode}

/** A link to a guide or reference panel; the group disambiguates repeated keys. */
export function PanelLink(props: PanelLinkProps) {
	const onSelect = usePanelNavigation()

	const target: PanelTarget =
		props.group === 'guide'
			? {group: 'guide', key: props.panel}
			: {group: 'reference', key: props.panel}

	return <DocLinkButton onClick={() => onSelect(target)}>{props.children}</DocLinkButton>
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

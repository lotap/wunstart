import {ArchitectureSection} from './architecture-section.tsx'
import {FeatureExplorer} from './feature-explorer/feature-explorer.tsx'
import {LocalDevPanel} from './local-dev-panel.tsx'

export function DocsPage({panel}: {panel?: string}) {
	return (
		<div className="mx-auto flex flex-col items-center gap-12 px-2 py-6">
			<LocalDevPanel />
			<FeatureExplorer panel={panel} />
			<ArchitectureSection />
		</div>
	)
}

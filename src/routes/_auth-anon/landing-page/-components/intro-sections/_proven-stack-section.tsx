import {FrameworkShelf} from '#/components/architecture/framework-shelf.tsx'

import {StickySectionHeader} from '../sticky-section-header.tsx'

/** Landing preview of the docs architecture explorer. Remove when customizing the landing page. */
export function ProvenStackSection() {
	// Offset the Primitives runway so the handoff keeps its original spacing.
	return (
		<section id="stack" className="w-full scroll-mt-24 sm:-mt-72">
			<StickySectionHeader
				title="Built on proven technology"
				description="The same tools you already trust, wired together with clear seams. Pick a piece to see what it does here."
			/>

			<div data-section-content className="mt-8">
				<div data-reveal>
					<FrameworkShelf />
				</div>
			</div>
		</section>
	)
}

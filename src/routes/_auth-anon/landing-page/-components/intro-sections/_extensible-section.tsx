import {FeatureGallery} from '../feature-gallery/feature-gallery.tsx'
import {StickySectionHeader} from '../sticky-section-header.tsx'

export function ExtensibleSection() {
	return (
		<section id="extensible" className="w-full scroll-mt-24">
			<StickySectionHeader
				title="Infinitely extensible"
				description="Ask for a feature in plain language. Here are three very different requests, all built from the same primitives."
			/>

			<div data-section-content className="mt-8">
				<FeatureGallery />
			</div>
		</section>
	)
}

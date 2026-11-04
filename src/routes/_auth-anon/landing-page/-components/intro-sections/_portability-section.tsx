import {Check} from 'lucide-react'

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '#/components/ui/card.tsx'

import {defaultPath, portabilityLayers} from '../../-content/sections.ts'
import {StickySectionHeader} from '../sticky-section-header.tsx'

export function PortabilitySection() {
	return (
		<section id="portability" className="w-full scroll-mt-24">
			<StickySectionHeader
				title="No vendor lock-in. Sane defaults."
				description="The app talks to interfaces, not vendors. The defaults are wiring you can replace one layer at a time."
			/>

			<div data-section-content className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
				<div className="flex flex-col">
					{portabilityLayers.map((layer) => (
						<div
							key={layer.name}
							data-reveal
							className="grid gap-2 border-t py-4 first:border-t-0 first:pt-0 sm:grid-cols-[120px_1fr] sm:gap-6"
						>
							<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
								{layer.name}
							</p>
							<div className="flex flex-col gap-1.5">
								<p className="text-base leading-relaxed">
									<span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
										Default{' '}
									</span>
									{layer.default}
								</p>
								<p className="text-base leading-relaxed text-muted-foreground">
									<span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
										Instead{' '}
									</span>
									{layer.alternative}
								</p>
							</div>
						</div>
					))}
				</div>

				<Card data-reveal data-reveal-delay="6" className="h-fit bg-muted/30">
					<CardHeader className="gap-2">
						<CardTitle className="text-lg font-semibold dark:font-medium">
							The default path
						</CardTitle>
						<CardDescription className="text-base leading-relaxed">
							Boring on purpose. Change one layer when you need to.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-2.5">
						{defaultPath.map((item) => (
							<div key={item} className="flex items-start gap-2.5 text-base leading-relaxed">
								<Check className="mt-1 size-4 shrink-0 text-muted-foreground" />
								<span>{item}</span>
							</div>
						))}
					</CardContent>
				</Card>
			</div>
		</section>
	)
}

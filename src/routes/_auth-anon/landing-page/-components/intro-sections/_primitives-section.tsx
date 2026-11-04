import {ArrowDown, ArrowRight} from 'lucide-react'
import {Fragment} from 'react'

import {Card, CardDescription, CardHeader, CardTitle} from '#/components/ui/card.tsx'

import {primitiveCards, primitiveSteps} from '../../-content/sections.ts'
import {StickySectionHeader} from '../sticky-section-header.tsx'

export function PrimitivesSection() {
	return (
		<section id="primitives" className="w-full scroll-mt-24">
			<StickySectionHeader
				title="Powered by primitives"
				description="wunshot gives every feature the same small vocabulary. Agents compose from it instead of inventing a new architecture each time."
			/>

			<div data-section-content className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
				{primitiveSteps.map((step, index) => (
					<Fragment key={step.label}>
						<div
							data-reveal
							data-reveal-delay={index * 3}
							className="flex-1 rounded-lg bg-muted/30 p-5 ring-1 ring-foreground/10"
						>
							<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
								{step.label}
							</p>
							<p className="mt-1 text-base leading-relaxed">{step.description}</p>
						</div>
						{index < primitiveSteps.length - 1 ? (
							<>
								<ArrowDown
									data-reveal
									data-reveal-delay={index * 3}
									className="mx-auto size-4 text-muted-foreground sm:hidden"
								/>
								<ArrowRight
									data-reveal
									data-reveal-delay={index * 3}
									className="mx-1 hidden size-4 shrink-0 text-muted-foreground sm:block"
								/>
							</>
						) : null}
					</Fragment>
				))}
			</div>

			{/* Extra desktop runway keeps the sticky title pinned through its exit. */}
			<div className="mt-5 grid gap-5 sm:pb-72 md:grid-cols-3">
				{primitiveCards.map((card, index) => (
					<Card key={card.title} data-reveal data-reveal-delay={index * 4} className="h-full">
						<CardHeader className="gap-2">
							<CardTitle className="text-lg font-semibold dark:font-medium">{card.title}</CardTitle>
							<CardDescription className="text-base leading-relaxed">
								{card.description}
							</CardDescription>
						</CardHeader>
					</Card>
				))}
			</div>
		</section>
	)
}

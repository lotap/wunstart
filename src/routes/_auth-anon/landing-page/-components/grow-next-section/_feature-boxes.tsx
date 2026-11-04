import type {RefObject} from 'react'

import {HERO_FEATURES} from '../../-content/hero.ts'
import {
	BOXES_BLOCK_TOP_VH,
	FEATURE_CARD_HEIGHT_REM,
	FEATURE_GAP_REM,
} from '../../-utils/hero-layout.ts'

export function FeatureBoxes({
	boxesBlockRef,
	cardRefs,
}: {
	boxesBlockRef: RefObject<HTMLDivElement | null>
	cardRefs: RefObject<Array<HTMLLIElement | null>>
}) {
	return (
		<div
			ref={boxesBlockRef}
			id="features"
			className="absolute inset-x-0 flex scroll-mt-24 justify-center px-4"
			style={{top: `${BOXES_BLOCK_TOP_VH}svh`}}
		>
			<ul className="flex w-full max-w-6xl flex-col" style={{gap: `${FEATURE_GAP_REM}rem`}}>
				{HERO_FEATURES.map((feature, index) => (
					<li
						key={feature}
						ref={(node) => {
							cardRefs.current[index] = node
						}}
						className="rounded-lg border bg-background p-5 opacity-0"
						style={{height: `${FEATURE_CARD_HEIGHT_REM}rem`}}
					>
						<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
							{feature}
						</p>
					</li>
				))}
			</ul>
		</div>
	)
}

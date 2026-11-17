import {Fragment, type RefObject} from 'react'

import {HERO_SUBLINE_WORDS} from '../../-content/hero.ts'
import {
	FEATURES_TEXT_BLOCK_TOP_VH,
	FEATURES_TEXT_STICKY_HEIGHT_VH,
	FEATURES_TEXT_STICKY_TOP_VH,
} from '../../-utils/hero-layout.ts'

export function FeaturesText({
	sublineRef,
	sublineWordRefs,
}: {
	sublineRef: RefObject<HTMLParagraphElement | null>
	sublineWordRefs: RefObject<Array<HTMLSpanElement | null>>
}) {
	return (
		<div
			className="pointer-events-none absolute inset-x-0 z-30"
			style={{
				top: `${FEATURES_TEXT_BLOCK_TOP_VH}svh`,
				height: `${FEATURES_TEXT_STICKY_HEIGHT_VH}svh`,
			}}
		>
			<div className="sticky" style={{top: `${FEATURES_TEXT_STICKY_TOP_VH}svh`}}>
				<div className="flex justify-center px-4">
					<p
						ref={sublineRef}
						className="pointer-events-auto text-center font-heading text-[clamp(2.4rem,6.3vw,6rem)] leading-[0.95] font-light tracking-[-0.035em] text-balance sm:whitespace-nowrap dark:font-extralight"
					>
						{HERO_SUBLINE_WORDS.map((word, index) => (
							<Fragment key={word}>
								<span
									ref={(node) => {
										sublineWordRefs.current[index] = node
									}}
									className="inline-block whitespace-nowrap opacity-0"
								>
									{word}
								</span>
								{index < HERO_SUBLINE_WORDS.length - 1 ? ' ' : null}
							</Fragment>
						))}
					</p>
				</div>
			</div>
		</div>
	)
}

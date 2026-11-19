import {Fragment, useRef} from 'react'

import {useStickyHeaderScroll} from '../-hooks/use-sticky-header-scroll.ts'

/** Large section title that enters mid-screen and pins near the top. */
export function StickySectionHeader({title, description}: {title: string; description: string}) {
	const headerRef = useRef<HTMLDivElement>(null)
	const words = title.split(' ')

	useStickyHeaderScroll({headerRef})

	return (
		// The bottom padding keeps the first content block 18svh below the copy.
		<div className="pointer-events-none sticky top-20 z-20 pb-[18svh] lg:top-[8svh]">
			<div ref={headerRef} className="pointer-events-auto flex flex-col gap-5">
				<h2 className="max-w-3xl font-heading text-4xl leading-none font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl dark:font-medium">
					{words.map((word, index) => (
						<Fragment key={word}>
							<span data-header-word className="inline-block opacity-0">
								{word}
							</span>
							{index < words.length - 1 ? ' ' : null}
						</Fragment>
					))}
				</h2>

				<p
					data-header-description
					className="max-w-2xl text-lg leading-relaxed text-muted-foreground opacity-0"
				>
					{description}
				</p>
			</div>
		</div>
	)
}

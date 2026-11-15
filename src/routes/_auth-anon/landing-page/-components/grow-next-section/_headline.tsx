import {cva} from 'class-variance-authority'
import type {RefObject} from 'react'

import {HERO_WORDS} from '../../-content/hero.ts'

type WordState = 'past' | 'active' | 'upcoming'

const wordVariants = cva(
	'col-start-1 row-start-1 whitespace-nowrap transition-[opacity,translate] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
	{
		variants: {
			state: {
				past: 'pointer-events-none translate-y-[-140%] opacity-0 duration-200 select-none',
				active: 'pointer-events-auto translate-y-0 opacity-100 duration-300 select-text',
				upcoming: 'pointer-events-none translate-y-[140%] opacity-0 duration-200 select-none',
			},
		},
		defaultVariants: {state: 'upcoming'},
	},
)

function wordState(index: number, activeIndex: number): WordState {
	if (index < activeIndex) return 'past'

	if (index === activeIndex) return 'active'

	return 'upcoming'
}

export function Headline({
	activeIndex,
	headlineRef,
	headlineLeadRef,
	slotRef,
	headlineTailRef,
	wordRefs,
}: {
	activeIndex: number
	headlineRef: RefObject<HTMLHeadingElement | null>
	headlineLeadRef: RefObject<HTMLSpanElement | null>
	slotRef: RefObject<HTMLSpanElement | null>
	headlineTailRef: RefObject<HTMLSpanElement | null>
	wordRefs: RefObject<Array<HTMLSpanElement | null>>
}) {
	return (
		<h2
			ref={headlineRef}
			id="grow-next-heading"
			className="pointer-events-auto flex max-w-full flex-col items-center justify-center gap-x-[0.24em] gap-y-2 text-center text-[clamp(2.4rem,6.3vw,6rem)] leading-[0.95] font-light tracking-[-0.035em] sm:flex-row sm:flex-wrap sm:items-baseline dark:font-extralight"
		>
			<span ref={headlineLeadRef} className="whitespace-nowrap">
				Bring your next
			</span>{' '}
			<span
				ref={slotRef}
				className="mx-[-0.08em] my-[-0.12em] inline-grid grid-cols-1 justify-items-center overflow-hidden px-[0.08em] py-[0.12em] align-baseline font-serif font-extrabold italic transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none sm:justify-items-start dark:font-bold"
			>
				{HERO_WORDS.map((word, index) => {
					const state = wordState(index, activeIndex)

					return (
						<span
							key={word}
							ref={(node) => {
								wordRefs.current[index] = node
							}}
							aria-hidden={state === 'active' ? undefined : true}
							className={wordVariants({state})}
						>
							{word}
						</span>
					)
				})}
			</span>{' '}
			<span ref={headlineTailRef} className="whitespace-nowrap">
				to life
			</span>
		</h2>
	)
}

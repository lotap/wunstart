import {cn} from 'cn'
import {ArrowUpRight, MoveLeft} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'

import {harnesses} from '../../-content/get-started.ts'
import {StartPrompt} from '../start-prompt.tsx'

import styles from './cta-section.module.css'

function HarnessLinks() {
	return (
		<div className="grid gap-2 sm:grid-cols-2">
			{harnesses.map((harness) => {
				const Icon = harness.icon

				return (
					<a
						key={harness.name}
						href={harness.href}
						target="_blank"
						rel="noreferrer"
						className="group/harness flex min-w-0 items-center gap-3 rounded-lg border bg-muted/20 p-3 transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<span
							aria-hidden
							className={cn(
								'flex size-9 shrink-0 items-center justify-center rounded-md border bg-background/60',
								!Icon && 'border-dashed',
							)}
						>
							{Icon && <Icon className="size-4 text-muted-foreground" />}
						</span>
						<span className="min-w-0 flex-1 truncate text-sm font-semibold dark:font-medium">
							{harness.name}
						</span>
						<ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover/harness:translate-x-0.5 group-hover/harness:-translate-y-0.5" />
					</a>
				)
			})}
		</div>
	)
}

/**
 * Time from the hint animation’s start to the moment the arrow finishes its
 * second tap and starts moving away, in milliseconds. The second tap lands at
 * 78% of the 2.4s cycle; the tooltip enters and leaves a beat later. Keep this
 * in sync with `copy-hint-bounce` in the module CSS.
 */
const COPY_HINT_MOVE_AWAY_MS = 1920

export function AgentPanel() {
	const [hintTooltipOpen, setHintTooltipOpen] = useState(false)
	const hintRef = useRef<SVGSVGElement>(null)
	const hintTimer = useRef<number | null>(null)

	const clearHintTimer = () => {
		if (hintTimer.current === null) return

		window.clearTimeout(hintTimer.current)
		hintTimer.current = null
	}

	/** Open the copy tooltip as the arrow finishes its taps and rebounds. */
	const handleHintStart = () => {
		clearHintTimer()

		hintTimer.current = window.setTimeout(() => {
			hintTimer.current = null

			const panel = hintRef.current?.closest('[data-slot="tabs-content"]')

			if (!panel || panel.hasAttribute('data-hidden')) return

			setHintTooltipOpen(true)
		}, COPY_HINT_MOVE_AWAY_MS)
	}

	/** Close it on the same beat in the second iteration. */
	const handleHintIteration = () => {
		clearHintTimer()

		hintTimer.current = window.setTimeout(() => {
			hintTimer.current = null
			setHintTooltipOpen(false)
		}, COPY_HINT_MOVE_AWAY_MS)
	}

	/** Close when the hint stops or is canceled. */
	const handleHintStop = () => {
		clearHintTimer()
		setHintTooltipOpen(false)
	}

	useEffect(() => {
		const hint = hintRef.current
		const panel = hint?.closest('[data-slot="tabs-content"]')

		if (!hint || !panel) return

		const closeHint = () => {
			if (hintTimer.current !== null) {
				window.clearTimeout(hintTimer.current)
				hintTimer.current = null
			}

			setHintTooltipOpen(false)
		}

		/** The panel exit cancels the animation; hidden tabs keep it running. */
		const observer = new MutationObserver(() => {
			if (panel.hasAttribute('data-hidden')) closeHint()
		})

		hint.addEventListener('animationcancel', closeHint)
		observer.observe(panel, {attributes: true, attributeFilter: ['data-hidden']})

		return () => {
			hint.removeEventListener('animationcancel', closeHint)
			observer.disconnect()

			if (hintTimer.current !== null) {
				window.clearTimeout(hintTimer.current)
				hintTimer.current = null
			}
		}
	}, [])

	return (
		<>
			<StartPrompt
				isCopyTooltipPinned={hintTooltipOpen}
				copyHint={
					<MoveLeft
						ref={hintRef}
						aria-hidden="true"
						className={cn(
							styles['copyHint'],
							'size-6 shrink-0 text-foreground',
							'translate-x-1 opacity-0 transition-[opacity,translate] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:translate-x-0 motion-reduce:transition-opacity',
						)}
						onAnimationStart={handleHintStart}
						onAnimationIteration={handleHintIteration}
						onAnimationEnd={handleHintStop}
					/>
				}
			/>
			<HarnessLinks />
		</>
	)
}

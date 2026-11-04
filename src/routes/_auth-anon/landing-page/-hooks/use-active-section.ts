import {useEffect, useState} from 'react'

/** Fraction of the viewport height used as the active-section line. */
const ACTIVE_SECTION_LINE = 0.35

/**
 * Track which section currently sits under the reading line. Sections are
 * checked in document order so the last one crossing the line wins.
 */
export function useActiveSection(sectionIds: ReadonlyArray<string>) {
	const [activeSection, setActiveSection] = useState<string | null>(null)

	useEffect(() => {
		let frame = 0

		const update = () => {
			frame = 0

			const line = window.innerHeight * ACTIVE_SECTION_LINE
			let nextSection: string | null = null

			for (const id of sectionIds) {
				const element = document.getElementById(id)

				if (!element) continue

				const rect = element.getBoundingClientRect()

				if (rect.top <= line) nextSection = id
			}

			setActiveSection((current) => (current === nextSection ? current : nextSection))
		}

		const schedule = () => {
			if (frame) return

			frame = requestAnimationFrame(update)
		}

		update()
		window.addEventListener('scroll', schedule, {passive: true})
		window.addEventListener('resize', schedule)

		return () => {
			window.removeEventListener('scroll', schedule)
			window.removeEventListener('resize', schedule)

			if (frame) cancelAnimationFrame(frame)
		}
	}, [sectionIds])

	return activeSection
}

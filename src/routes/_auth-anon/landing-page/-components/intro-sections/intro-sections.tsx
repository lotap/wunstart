import {useRef} from 'react'

import type {InstallTab} from '../../-content/get-started.ts'
import {useScrollReveal} from '../../-hooks/use-scroll-reveal.ts'
import {GetStartedSection} from '../cta-section/cta-section.tsx'
import {ExtensibleSection} from './_extensible-section.tsx'
import {PortabilitySection} from './_portability-section.tsx'
import {PrimitivesSection} from './_primitives-section.tsx'
import {ProvenStackSection} from './_proven-stack-section.tsx'

export function IntroSections({
	installTab,
	onInstallTabChange,
}: {
	installTab: InstallTab
	onInstallTabChange: (tab: InstallTab) => void
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const svhProbeRef = useRef<HTMLDivElement>(null)

	useScrollReveal(containerRef, svhProbeRef)

	return (
		<>
			<div
				ref={containerRef}
				data-intro-sections
				className="relative mx-auto flex w-full max-w-6xl flex-col gap-72 px-4 pt-72"
			>
				<div
					ref={svhProbeRef}
					data-svh-probe
					aria-hidden="true"
					className="pointer-events-none absolute h-[1svh] w-px"
				/>
				<ExtensibleSection />
				<PrimitivesSection />
				<ProvenStackSection />
				<PortabilitySection />
			</div>
			<GetStartedSection installTab={installTab} onInstallTabChange={onInstallTabChange} />
		</>
	)
}

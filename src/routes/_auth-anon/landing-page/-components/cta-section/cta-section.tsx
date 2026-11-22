import {cva} from 'class-variance-authority'
import {cn} from 'cn'
import {ArrowUpRight} from 'lucide-react'
import {type Ref, type RefObject, useRef} from 'react'

import {type InstallTab, taglineLines} from '../../-content/get-started.ts'
import {useCtaScroll} from '../../-hooks/use-cta-scroll.ts'
import {LazyShaderBackdrop} from '../shader-backdrop.tsx'
import {InstallTabs} from './_install-tabs.tsx'

import styles from './cta-section.module.css'
import shimmerStyles from './shimmer.module.css'

const ctaLineVariants = cva('block opacity-0', {
	variants: {
		emphasis: {true: 'font-serif font-bold dark:font-semibold'},
		muted: {true: 'text-muted-foreground'},
	},
	defaultVariants: {emphasis: false, muted: false},
})

function PanelFooter({panelRef}: {panelRef: Ref<HTMLDivElement>}) {
	return (
		<div
			ref={panelRef}
			data-cta-panel
			className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl bg-card px-5 py-4 opacity-0 ring-1 ring-foreground/10"
		>
			<a
				href="https://github.com/lotap/wunstart"
				target="_blank"
				rel="noreferrer"
				className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline dark:font-medium"
			>
				Open on GitHub <ArrowUpRight aria-hidden="true" className="size-3.5" />
			</a>
			<p className="text-sm text-muted-foreground">MIT licensed</p>
		</div>
	)
}

function CtaTagline({
	taglineRef,
	lineRefs,
}: {
	taglineRef: RefObject<HTMLHeadingElement | null>
	lineRefs: RefObject<Array<HTMLSpanElement | null>>
}) {
	return (
		<h2
			ref={taglineRef}
			className="pointer-events-auto flex w-fit flex-col font-heading text-5xl leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-7xl"
		>
			{taglineLines.map((line, index) => (
				<span
					key={line.text}
					className="mx-[-0.08em] my-[-0.12em] overflow-hidden px-[0.08em] py-[0.12em]"
				>
					<span
						ref={(node) => {
							lineRefs.current[index] = node
						}}
						data-cta-line
						className={ctaLineVariants({emphasis: line.emphasis, muted: line.muted})}
					>
						{line.text}
					</span>
				</span>
			))}
		</h2>
	)
}

export function GetStartedSection({
	installTab,
	onInstallTabChange,
}: {
	installTab: InstallTab
	onInstallTabChange: (tab: InstallTab) => void
}) {
	const sectionRef = useRef<HTMLElement>(null)
	const shaderFrameRef = useRef<HTMLDivElement>(null)
	const svhProbeRef = useRef<HTMLDivElement>(null)
	const taglineRef = useRef<HTMLHeadingElement>(null)
	const taglineLineRefs = useRef<Array<HTMLSpanElement | null>>([])
	const panelRefs = useRef<Array<HTMLDivElement | null>>([])

	useCtaScroll({
		sectionRef,
		shaderFrameRef,
		svhProbeRef,
		taglineRef,
		lineRefs: taglineLineRefs,
		panelRefs,
	})

	return (
		<section
			ref={sectionRef}
			id="get-started"
			className="relative isolate mt-48 w-full scroll-mt-24 overflow-clip"
		>
			<div
				ref={svhProbeRef}
				aria-hidden="true"
				className="pointer-events-none absolute top-0 left-0 h-[1svh] w-px opacity-0"
			/>

			<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
				<div ref={shaderFrameRef} className="sticky top-0 h-svh [&_canvas]:will-change-transform">
					<LazyShaderBackdrop
						className={cn(styles['mask'], 'inset-0')}
						speed={0.25}
						noise={0.12}
						intensity={0.45}
						softness={0.55}
						rootMargin="100% 0px"
					/>
				</div>
			</div>

			<div className="relative min-h-[160svh] lg:min-h-[132svh]">
				<div data-cta-stage className="lg:sticky lg:top-0 lg:flex lg:min-h-svh lg:items-center">
					<div className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-[40svh] pb-24 sm:pb-32 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:py-32">
						<div className="pointer-events-none sticky top-20 z-10 min-h-[52svh] w-full lg:static lg:z-auto lg:col-start-2 lg:row-start-1 lg:min-h-0 lg:w-auto lg:justify-self-end">
							<CtaTagline taglineRef={taglineRef} lineRefs={taglineLineRefs} />
						</div>

						<div
							id="get-started-panel"
							className="flex min-w-0 scroll-mt-20 flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:scroll-mt-0"
						>
							<div
								ref={(node) => {
									panelRefs.current[0] = node
								}}
								data-cta-panel
								className="relative isolate min-w-0 rounded-xl p-px opacity-0"
							>
								{/* Clip the shimmer without clipping the copy hint that straddles the panel edge. */}
								<div
									aria-hidden="true"
									className={cn(
										'pointer-events-none absolute inset-0 overflow-hidden rounded-xl',
										shimmerStyles['shimmer'],
									)}
								/>
								<div className="relative z-10 rounded-[calc(var(--radius-xl)-1px)] bg-card p-5 sm:p-6">
									<InstallTabs installTab={installTab} onInstallTabChange={onInstallTabChange} />
								</div>
							</div>

							<PanelFooter
								panelRef={(node) => {
									panelRefs.current[1] = node
								}}
							/>
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

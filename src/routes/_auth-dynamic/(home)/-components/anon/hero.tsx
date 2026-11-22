import {GrainGradient} from '@paper-design/shaders-react'

export function Hero() {
	return (
		<section className="flex w-full max-w-5xl flex-col gap-2 sm:flex-row">
			<div className="flex grow sm:order-2 sm:items-end md:justify-end">
				<h1 className="flex flex-col py-12 font-heading text-4xl">
					<span>Build </span>
					<span>for </span>
					<span className="font-serif font-bold dark:font-semibold">humans </span>
					<span className="text-muted-foreground">with </span>
					<span className="text-muted-foreground">agents</span>
				</h1>
			</div>

			<div
				aria-hidden="true"
				className="h-56 w-full animate-in bg-foreground/50 fade-in sm:order-1 sm:h-128 sm:w-3/4 md:w-2/3"
			>
				<GrainGradient
					width="100%"
					height="100%"
					colors={['#ffffff']}
					colorBack="#0a0a0a"
					softness={0.3}
					intensity={0.75}
					noise={1}
					// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names
					shape="ripple"
					speed={1}
					rotation={180}
				/>
			</div>
		</section>
	)
}

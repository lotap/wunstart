import {FrameworkShelf} from '#/components/architecture/framework-shelf.tsx'

export function ArchitectureSection() {
	return (
		<section
			id="architectural-overview"
			aria-labelledby="architectural-overview-title"
			className="w-full max-w-5xl"
		>
			<header className="flex flex-col gap-2">
				<h3 id="architectural-overview-title" className="max-w-2xl font-heading text-3xl">
					Architectural overview
				</h3>
			</header>
			<div className="mt-8 flex flex-col gap-5">
				<div className="flex flex-col gap-2">
					<h4 className="font-heading text-xl">The stack</h4>
					<p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
						The tools behind each layer, the folders they live in, and a link to each project’s docs
						or repository.
					</p>
				</div>
				<FrameworkShelf />
			</div>
		</section>
	)
}

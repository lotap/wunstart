import {register, render} from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'

register(flowchart)

const diagramConfig = `%%{init: {"flowchart": {"nodeSpacing": 12, "rankSpacing": 12}}}%%\n`

/** Static Mermaid source rendered by Pele. No user input. */
export function DocDiagram({
	source,
	label,
	idPrefix,
}: {
	source: string
	label: string
	idPrefix: string
}) {
	const {svg} = render(`${diagramConfig}${source}`, {idPrefix, fontSize: 22})

	return (
		<div
			// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable diagram needs keyboard focus
			tabIndex={0}
			aria-label={`${label} diagram`}
			className="scrollbar-thin overflow-x-auto pb-1 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			<div
				suppressHydrationWarning
				className="mx-auto w-max min-w-full md:flex md:w-full md:justify-center [&_svg]:h-auto [&_svg]:max-h-none [&_svg]:w-auto [&_svg]:max-w-none md:[&_svg]:max-w-full"
				dangerouslySetInnerHTML={{__html: svg}}
			/>
		</div>
	)
}

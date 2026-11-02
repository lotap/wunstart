import {register, render} from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'

export const groups = [
	{label: 'Front end', span: 'col-span-4', flowTitle: 'Request rendering path'},
	{label: 'Back end', span: 'col-span-4', flowTitle: 'Op execution path'},
	{label: 'Code consistency', span: 'col-span-3', flowTitle: 'Lint pipeline'},
	{label: 'Deployment', span: 'col-span-3', flowTitle: 'Worker data path'},
] as const

register(flowchart)

export const groupFlowSvgs = [
	render(
		`flowchart LR
  request(["Request"]) --> start["TanStack Start"]
  start -->|"SSR"| react["React"]
  react -->|"renders"| ui["shadcn/ui"]
  tailwind["Tailwind"] -.->|"styles"| ui`,
		{idPrefix: 'shelf-group-frontend', fontSize: 13},
	).svg,
	render(
		`flowchart LR
  start["TanStack<br/>Start"] -->|"server fn"| effect["Effect"]
  effect -->|"validates"| schema["Effect<br/>Schema"]
  effect -->|"queries"| drizzle["Drizzle"]
  drizzle -->|"SQL"| pg[("Postgres")]`,
		{idPrefix: 'shelf-group-backend', fontSize: 13},
	).svg,
	render(
		`flowchart LR
  source["Source"] -->|"lint"| oxlint["oxlint"]
  oxlint -->|"applies"| rules["wunstart · wunshot · anti-slop · React Doctor"]`,
		{idPrefix: 'shelf-group-consistency', fontSize: 13},
	).svg,
	render(
		`flowchart LR
  worker["Worker"] -->|"state"| do["Durable<br/>Objects"]
  worker -->|"pooled SQL"| hyper["Hyperdrive"]
  hyper -->|"SQL"| pg[("Postgres")]
  alchemy["Alchemy"] -.-> worker`,
		{idPrefix: 'shelf-group-deployment', fontSize: 13},
	).svg,
]

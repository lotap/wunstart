import {ArrowUpRight} from 'lucide-react'

export function ExternalDocLink({href, children}: {href: string; children: React.ReactNode}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-1 text-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			{children}
			<ArrowUpRight className="size-3" aria-hidden="true" />
		</a>
	)
}

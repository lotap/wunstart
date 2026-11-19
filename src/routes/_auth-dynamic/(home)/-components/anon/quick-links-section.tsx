import {Link} from '@tanstack/react-router'

import {CopyButton} from '#/components/global/copy-button.tsx'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '#/components/ui/card.tsx'
import {openTanStackDevtools} from '#/integrations/tanstack-devtools.ts'

import {SlashGrid} from './slash-grid.tsx'

const drizzleStudioUrl = 'https://local.drizzle.studio'
const drizzleStudioCommand = 'bun run db:studio'
const reactEmailUrl = 'http://localhost:3001'
const reactEmailCommand = 'bun run dev:email'

function CardOverlayAnchor({href, label}: {href: string; label: string}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			aria-label={label}
			className="absolute inset-0 z-20 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
		/>
	)
}

function QuickLinkCard({
	label,
	description,
	detail,
	copyText,
}: {
	label: string
	description: string
	detail?: string
	copyText?: string
}) {
	return (
		<Card
			size="sm"
			className="relative h-full w-full transition-colors group-hover:bg-muted/30 group-hover:ring-foreground/20"
		>
			<CardHeader className="pointer-events-none relative z-10 gap-1">
				<CardTitle className="font-mono text-sm">{label}</CardTitle>
				<CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
			</CardHeader>
			{detail && (
				<CardContent className="pointer-events-none relative z-30 mt-auto">
					{copyText ? (
						<div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
							<code className="min-w-0 truncate font-mono text-xs text-foreground">{detail}</code>
							<span className="pointer-events-auto relative z-20 shrink-0">
								<CopyButton text={copyText} label={label} copyLabel="Copy command" />
							</span>
						</div>
					) : (
						<p className="font-mono text-xs leading-relaxed text-muted-foreground">{detail}</p>
					)}
				</CardContent>
			)}
		</Card>
	)
}

export function QuickLinksSection() {
	const mailpitUrl = import.meta.env.MAILPIT_URL ?? null

	return (
		<section aria-labelledby="quick-links-title" className="w-full max-w-5xl">
			<SlashGrid />
			<h3 id="quick-links-title" className="px-6 py-3 text-right font-heading text-3xl">
				Quick links
			</h3>
			<SlashGrid />
			<div className="flex pt-6">
				{/* // GUTTER */}
				<SlashGrid className="w-1/6 grid-cols-10 sm:hidden" contentLength={10 * 35} />
				<SlashGrid
					className="hidden w-1/4 grid-cols-15 sm:grid md:hidden"
					contentLength={15 * 24}
				/>
				<SlashGrid
					className="hidden w-1/3 grid-cols-20 md:grid lg:hidden"
					contentLength={20 * 23}
				/>
				<SlashGrid className="hidden w-5/12 grid-cols-25 lg:grid" contentLength={25 * 24} />
				<div className="flex w-5/6 flex-col gap-5 px-6 pt-3 pb-6 sm:w-3/4 md:w-2/3 lg:w-7/12">
					<p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
						Familiarize yourself with these tools for development. They will always be reachable
						from the docs page.
					</p>
					<ul className="grid gap-3 sm:grid-cols-2">
						<li className="group relative h-full sm:col-span-2">
							<Link
								to="/docs"
								aria-label="Open /docs"
								className="absolute inset-0 z-20 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
							/>
							<QuickLinkCard
								label="/docs"
								description="Developer reference for the stack, routes, features, and local services."
								detail="src/routes/_dev/docs/route.tsx"
							/>
						</li>
						<li className="group relative h-full">
							{mailpitUrl && <CardOverlayAnchor href={mailpitUrl} label="Open Mailpit" />}
							<QuickLinkCard
								label="Mailpit"
								description="Catches local sign-up and account emails."
								detail={mailpitUrl ?? 'Set MAILPIT_URL in .env.local'}
							/>
						</li>
						<li className="group relative h-full">
							<CardOverlayAnchor href={drizzleStudioUrl} label="Open Drizzle Studio" />
							<QuickLinkCard
								label="Drizzle Studio"
								description="Run this command, then open the database browser."
								detail={drizzleStudioCommand}
								copyText={drizzleStudioCommand}
							/>
						</li>
						<li className="group relative h-full">
							<CardOverlayAnchor href={reactEmailUrl} label="Open React Email" />
							<QuickLinkCard
								label="React Email"
								description="Run this command, then open the template preview."
								detail={reactEmailCommand}
								copyText={reactEmailCommand}
							/>
						</li>
						<li className="group relative h-full">
							<button
								type="button"
								onClick={openTanStackDevtools}
								aria-label="Open TanStack DevTools"
								className="absolute inset-0 z-20 rounded-xl focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
							/>
							<QuickLinkCard
								label="TanStack DevTools"
								description="Shows routes, queries, and forms in the running app."
							/>
						</li>
					</ul>
				</div>
			</div>
			<SlashGrid contentLength={60 * 2} />
		</section>
	)
}

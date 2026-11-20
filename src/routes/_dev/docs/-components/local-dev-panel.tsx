import {cn} from 'cn'
import {ArrowUpRight, X} from 'lucide-react'
import {useRef, useState} from 'react'

import {Button, buttonVariants} from '#/components/ui/button.tsx'
import {openTanStackDevtools} from '#/integrations/tanstack-devtools.ts'

import {localServices, mailpitUrl} from '../-utils/local-services.ts'
import {CommandBlock} from './code-block.tsx'
import {DocLink, MicroLabel} from './doc-ui.tsx'

function ShortcutCard({children}: {children: React.ReactNode}) {
	return <li className="flex flex-col gap-4 bg-background p-5 md:p-6">{children}</li>
}

function ShortcutHeader({title, children}: {title: string; children: React.ReactNode}) {
	return (
		<div className="flex flex-col gap-1">
			<h4 className="font-heading text-lg font-medium">{title}</h4>
			<div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
		</div>
	)
}

function ShortcutAction({children}: {children: React.ReactNode}) {
	return <div className="mt-auto">{children}</div>
}

function TerminalHelpTrigger({
	open,
	onToggle,
}: {
	open: boolean
	onToggle: (trigger: HTMLButtonElement) => void
}) {
	return (
		<button
			type="button"
			aria-expanded={open}
			aria-controls="terminal-help"
			onClick={(event) => onToggle(event.currentTarget)}
			className="inline-flex cursor-pointer items-center uppercase underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
		>
			terminal
		</button>
	)
}

export function LocalDevPanel() {
	const [terminalOpen, setTerminalOpen] = useState(false)
	const terminalTriggerRef = useRef<HTMLButtonElement>(null)

	const toggleTerminal = (trigger: HTMLButtonElement) => {
		terminalTriggerRef.current = trigger
		setTerminalOpen((open) => !open)
	}

	return (
		<section id="local-development" aria-label="Local development" className="w-full max-w-5xl">
			<ul className="grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2 lg:grid-cols-4">
				<ShortcutCard>
					<ShortcutHeader title="Email inbox">
						<p>
							<DocLink
								href="https://mailpit.axllent.org/docs/"
								target="_blank"
								rel="noreferrer"
								aria-label="Mailpit documentation"
							>
								Mailpit
							</DocLink>{' '}
							catches dev emails so you can receive passcodes, confirmations, etc. without a real
							inbox.
						</p>
					</ShortcutHeader>
					<ShortcutAction>
						{mailpitUrl ? (
							<a
								href={mailpitUrl}
								target="_blank"
								rel="noreferrer"
								className={cn(buttonVariants({size: 'lg'}), 'w-full')}
							>
								Open Mailpit
							</a>
						) : (
							<p className="text-xs text-muted-foreground">Set MAILPIT_URL in .env.local</p>
						)}
					</ShortcutAction>
				</ShortcutCard>

				<ShortcutCard>
					<ShortcutHeader title="Database browser">
						<p>
							<DocLink
								href="https://orm.drizzle.team/drizzle-studio/overview"
								target="_blank"
								rel="noreferrer"
								aria-label="Drizzle Studio documentation"
							>
								Drizzle Studio
							</DocLink>{' '}
							shows the app’s tables and rows.
						</p>
					</ShortcutHeader>
					<div className="flex flex-col gap-1.5">
						<MicroLabel>
							Run this in a <TerminalHelpTrigger open={terminalOpen} onToggle={toggleTerminal} />
						</MicroLabel>
						<CommandBlock command={localServices.studioCommand} label="Drizzle Studio command" />
					</div>
					<ShortcutAction>
						<a
							href={localServices.studioUrl}
							target="_blank"
							rel="noreferrer"
							className={cn(buttonVariants({size: 'lg'}), 'w-full')}
						>
							Open Drizzle Studio
						</a>
					</ShortcutAction>
				</ShortcutCard>

				<ShortcutCard>
					<ShortcutHeader title="Email preview">
						<p>
							<DocLink
								href="https://react.email/docs"
								target="_blank"
								rel="noreferrer"
								aria-label="React Email documentation"
							>
								React Email
							</DocLink>{' '}
							previews the app’s templates in a browser and hot-reloads edits.
						</p>
					</ShortcutHeader>
					<div className="flex flex-col gap-1.5">
						<MicroLabel>
							Run this in a <TerminalHelpTrigger open={terminalOpen} onToggle={toggleTerminal} />
						</MicroLabel>
						<CommandBlock command={localServices.reactEmailCommand} label="React Email command" />
					</div>
					<ShortcutAction>
						<a
							href={localServices.reactEmailUrl}
							target="_blank"
							rel="noreferrer"
							className={cn(buttonVariants({size: 'lg'}), 'w-full')}
						>
							Open React Email
						</a>
					</ShortcutAction>
				</ShortcutCard>

				<ShortcutCard>
					<ShortcutHeader title="DevTools">
						<p>
							<DocLink
								href="https://tanstack.com/devtools/latest/docs/overview"
								target="_blank"
								rel="noreferrer"
								aria-label="TanStack DevTools documentation"
							>
								TanStack DevTools
							</DocLink>{' '}
							shows routes, queries, and forms while you click around.
						</p>
					</ShortcutHeader>
					<ShortcutAction>
						<Button size="lg" className="w-full" onClick={openTanStackDevtools}>
							Open devtools
						</Button>
					</ShortcutAction>
				</ShortcutCard>
			</ul>

			{terminalOpen && (
				<div id="terminal-help" className="mt-4 rounded-xl border bg-muted/20 p-5 md:p-6">
					<div className="flex items-start justify-between gap-4">
						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-2">
								<h4 className="font-heading text-lg font-medium">What’s a terminal?</h4>
								<p className="max-w-2xl text-sm text-muted-foreground">
									A terminal is a text-only window where you type a command and press Return or
									Enter to run it. It’s how you imagine hackers breaking into the mainframe.
								</p>
								<p className="max-w-2xl text-sm text-muted-foreground">
									Don’t have one yet? Install one:
								</p>
							</div>

							<div className="grid gap-3 sm:grid-cols-2">
								<a
									href="https://ghostty.org/"
									target="_blank"
									rel="noreferrer"
									className={cn(
										buttonVariants({variant: 'outline', size: 'lg'}),
										'h-auto w-full justify-between gap-3 px-4 py-3 text-left',
									)}
								>
									<span className="flex flex-col items-start gap-0.5">
										<span className="font-medium">Install Ghostty</span>
										<span className="text-xs font-normal text-muted-foreground">
											macOS and Linux
										</span>
									</span>
									<ArrowUpRight
										aria-hidden="true"
										className="size-4 shrink-0 text-muted-foreground"
									/>
								</a>
								<a
									href="https://learn.microsoft.com/en-us/windows/terminal/"
									target="_blank"
									rel="noreferrer"
									className={cn(
										buttonVariants({variant: 'outline', size: 'lg'}),
										'h-auto w-full justify-between gap-3 px-4 py-3 text-left',
									)}
								>
									<span className="flex flex-col items-start gap-0.5">
										<span className="font-medium">Install Windows Terminal</span>
										<span className="text-xs font-normal text-muted-foreground">Windows</span>
									</span>
									<ArrowUpRight
										aria-hidden="true"
										className="size-4 shrink-0 text-muted-foreground"
									/>
								</a>
							</div>

							<p className="max-w-2xl text-sm text-muted-foreground">
								<DocLink
									href="https://terminalcheatsheet.com/guides/navigate-terminal"
									target="_blank"
									rel="noreferrer"
								>
									Navigate
								</DocLink>{' '}
								to the project root, paste the command you need, and press Enter.
							</p>
						</div>

						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Close terminal explanation"
							onClick={() => {
								setTerminalOpen(false)
								terminalTriggerRef.current?.focus()
							}}
						>
							<X />
						</Button>
					</div>
				</div>
			)}
		</section>
	)
}

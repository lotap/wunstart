import {TriangleAlert} from 'lucide-react'

import {CopyButton} from '#/components/global/copy-button.tsx'
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockHeader,
	CodeBlockTitle,
} from '#/components/ui/code-block.tsx'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '#/components/ui/tabs.tsx'

import {installCommands, installMethods, type InstallTab} from '../../-content/get-started.ts'
import {AgentPanel} from './_agent-panel.tsx'

function InstallCommands() {
	return (
		<Tabs defaultValue="bun" className="gap-2">
			<TabsList>
				{installMethods.map((method) => (
					<TabsTrigger
						key={method}
						value={method}
						className="font-mono text-xs tracking-widest uppercase"
					>
						{method}
					</TabsTrigger>
				))}
			</TabsList>

			{installMethods.map((method) => (
				<TabsContent key={method} value={method}>
					<CodeBlock className="bg-muted/30">
						<CodeBlockHeader className="border-b pb-2">
							<CodeBlockTitle className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
								Terminal
							</CodeBlockTitle>
							<CodeBlockActions>
								<CopyButton
									text={installCommands[method]}
									label={`${method} install command`}
									copyLabel="Copy command"
								/>
							</CodeBlockActions>
						</CodeBlockHeader>
						<CodeBlockContent>{installCommands[method]}</CodeBlockContent>
					</CodeBlock>
				</TabsContent>
			))}
		</Tabs>
	)
}

function ManualPanel() {
	return (
		<>
			<p className="flex items-start gap-2 text-sm leading-relaxed font-semibold text-destructive dark:font-medium">
				<TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
				<span>
					Requires{' '}
					<a
						href="https://docs.docker.com/compose/install/"
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-4 hover:opacity-80"
					>
						Docker Compose
					</a>{' '}
					to run the dev environment.
				</span>
			</p>

			<InstallCommands />
		</>
	)
}

export function InstallTabs({
	installTab,
	onInstallTabChange,
}: {
	installTab: InstallTab
	onInstallTabChange: (tab: InstallTab) => void
}) {
	return (
		<Tabs
			value={installTab}
			onValueChange={(value) => {
				if (value === 'agent' || value === 'manual') onInstallTabChange(value)
			}}
			className="gap-5"
		>
			<TabsList className="w-full">
				<TabsTrigger value="agent" className="font-semibold dark:font-medium">
					Agent
				</TabsTrigger>
				<TabsTrigger value="manual" className="font-semibold dark:font-medium">
					Manual
				</TabsTrigger>
			</TabsList>

			{/* Both panels share one grid cell so the taller panel sets the height.
			    `hidden={false}` keeps the inactive panel in layout; Base UI still marks
			    it inert and `data-hidden`, which `data-hidden:invisible` hides. */}
			<div className="grid min-w-0">
				<TabsContent
					value="agent"
					keepMounted
					hidden={false}
					className="col-start-1 row-start-1 flex min-w-0 flex-col gap-4 data-hidden:invisible"
				>
					<AgentPanel />
				</TabsContent>

				<TabsContent
					value="manual"
					keepMounted
					hidden={false}
					className="col-start-1 row-start-1 flex min-w-0 flex-col gap-5 data-hidden:invisible"
				>
					<ManualPanel />
				</TabsContent>
			</div>
		</Tabs>
	)
}

import {CopyButton} from '#/components/global/copy-button.tsx'
import {
	CodeBlock as CodeBlockRoot,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockHeader,
	CodeBlockLine,
} from '#/components/ui/code-block.tsx'
import {useHighlightedCode} from '#/hooks/use-highlighted-code.ts'

import {MicroLabel} from './doc-ui.tsx'

function CodeBlockShell({
	copyLabel,
	copyable = true,
	label,
	value,
	children,
}: {
	copyLabel: string
	copyable?: boolean
	label: string
	value: string
	children: React.ReactNode
}) {
	return (
		<CodeBlockRoot className="bg-background/70">
			<CodeBlockHeader className="border-b pb-2">
				<MicroLabel>{label}</MicroLabel>
				{copyable && (
					<CodeBlockActions>
						<CopyButton text={value} label={label} copyLabel={copyLabel} />
					</CodeBlockActions>
				)}
			</CodeBlockHeader>
			{children}
		</CodeBlockRoot>
	)
}

export function CodeBlock({
	code,
	label,
	language,
}: {
	code: string
	label: string
	language?: string
}) {
	return (
		<CodeBlockShell label={label} value={code} copyLabel="Copy code">
			{language ? (
				<HighlightedCode code={code} language={language} />
			) : (
				<CodeBlockContent className="text-sm leading-relaxed text-muted-foreground">
					{code}
				</CodeBlockContent>
			)}
		</CodeBlockShell>
	)
}

function HighlightedCode({code, language}: {code: string; language: string}) {
	const lines = useHighlightedCode(code, language)

	return (
		<CodeBlockContent className="text-sm leading-relaxed text-muted-foreground">
			{lines.map((line, index) => (
				// oxlint-disable-next-line react/no-array-index-key react-doctor/no-array-index-as-key -- highlighted lines have no stable id
				<CodeBlockLine key={index}>{line}</CodeBlockLine>
			))}
		</CodeBlockContent>
	)
}

export function CommandBlock({command, label}: {command: string; label: string}) {
	return (
		<div className="overflow-hidden rounded-lg border bg-background/70">
			<div className="flex items-center justify-between gap-2 px-3 py-2">
				<code className="truncate font-mono text-xs text-foreground">{command}</code>
				<CopyButton text={command} label={label} copyLabel="Copy command" />
			</div>
		</div>
	)
}

export function PromptBlock({
	copyable = true,
	prompt,
	title,
}: {
	copyable?: boolean
	prompt: string
	title: string
}) {
	return (
		<CodeBlockShell label={title} value={prompt} copyLabel="Copy prompt" copyable={copyable}>
			<CodeBlockContent wrap className="text-base leading-relaxed text-muted-foreground">
				{prompt}
			</CodeBlockContent>
		</CodeBlockShell>
	)
}

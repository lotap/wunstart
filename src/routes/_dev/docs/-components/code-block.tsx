import {cn} from 'cn'
import {ChevronDown} from 'lucide-react'
import {useId, useState} from 'react'

import {CopyButton} from '#/components/global/copy-button.tsx'
import {Button} from '#/components/ui/button.tsx'
import {
	CodeBlock as CodeBlockRoot,
	CodeBlockContent,
	CodeBlockHeader,
	CodeBlockLine,
} from '#/components/ui/code-block.tsx'
import {useHighlightedCode} from '#/hooks/use-highlighted-code.ts'

import {InlineCode, MicroLabel} from './doc-ui.tsx'

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
		<CodeBlockRoot>
			<CodeBlockHeader>
				<MicroLabel>{label}</MicroLabel>
				{copyable && (
					<div className="ms-auto">
						<CopyButton text={value} label={label} copyLabel={copyLabel} />
					</div>
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
				<CodeBlockContent>{code}</CodeBlockContent>
			)}
		</CodeBlockShell>
	)
}

function HighlightedCode({code, language}: {code: string; language: string}) {
	const lines = useHighlightedCode(code, language)

	return (
		<CodeBlockContent>
			{lines.map((line, index) => (
				// oxlint-disable-next-line react/no-array-index-key react-doctor/no-array-index-as-key -- highlighted lines have no stable id
				<CodeBlockLine key={index}>{line}</CodeBlockLine>
			))}
		</CodeBlockContent>
	)
}

export function CommandBlock({command, label}: {command: string; label: string}) {
	return (
		<div className="overflow-hidden rounded-lg border border-input dark:bg-input/30">
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
			<CodeBlockContent wrap>{prompt}</CodeBlockContent>
		</CodeBlockShell>
	)
}

/** Render Markdown-style inline code in a prompt as inline chips. */
function renderPromptText(prompt: string) {
	return prompt.split(/(`[^`]+`)/g).map((part, index) => {
		const isCode = part.startsWith('`') && part.endsWith('`')

		return (
			// oxlint-disable-next-line react/no-array-index-key react-doctor/no-array-index-as-key -- prompt segments have no stable ids
			<span key={index}>{isCode ? <InlineCode>{part.slice(1, -1)}</InlineCode> : part}</span>
		)
	})
}

/**
 * Long agent prompt as a prose panel. The body stays collapsed until the
 * reader asks for the full text; the header keeps the copy action visible.
 */
export function AgentPrompt({prompt, title}: {prompt: string; title: string}) {
	const [expanded, setExpanded] = useState(false)
	const bodyId = useId()

	return (
		<div>
			<CodeBlockShell label={title} value={prompt} copyLabel="Copy prompt">
				<div className="px-3 pt-2 pb-5">
					<div
						id={bodyId}
						className={cn(
							'font-mono text-sm leading-relaxed whitespace-pre-wrap text-foreground',
							!expanded && 'line-clamp-4',
						)}
					>
						{renderPromptText(prompt)}
					</div>
				</div>
			</CodeBlockShell>
			<div className="relative z-10 -mt-3 flex justify-center">
				<Button
					type="button"
					variant="secondary"
					size="xs"
					aria-expanded={expanded}
					aria-controls={bodyId}
					onClick={() => setExpanded((value) => !value)}
					className="border border-border px-3 aria-expanded:hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]"
				>
					{expanded ? 'Show less' : 'Show full prompt'}
					<ChevronDown
						className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
						aria-hidden="true"
					/>
				</Button>
			</div>
		</div>
	)
}

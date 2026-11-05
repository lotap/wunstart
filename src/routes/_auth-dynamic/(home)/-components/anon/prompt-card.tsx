import {CopyButton} from '#/components/global/copy-button.tsx'
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockHeader,
} from '#/components/ui/code-block.tsx'

export type Prompt = {
	label: string
	body: string
}

export function PromptCard({label, body}: Prompt) {
	return (
		<CodeBlock className="bg-card">
			<CodeBlockHeader className="border-b pb-2">
				<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{label}</p>
				<CodeBlockActions>
					<CopyButton text={body} label={label} copyLabel="Copy prompt" />
				</CodeBlockActions>
			</CodeBlockHeader>
			<CodeBlockContent wrap className="text-sm leading-relaxed">
				{body}
			</CodeBlockContent>
		</CodeBlock>
	)
}

import {cn} from 'cn'
import type {ReactNode} from 'react'

import {CopyButton} from '#/components/global/copy-button.tsx'
import {
	CodeBlock,
	CodeBlockActions,
	CodeBlockContent,
	CodeBlockHeader,
	CodeBlockTitle,
} from '#/components/ui/code-block.tsx'

import {startPrompt} from '../-content/get-started.ts'

export function StartPrompt({
	className,
	action,
	copyHint,
	isCopyTooltipPinned = false,
}: {
	className?: string
	action?: ReactNode
	copyHint?: ReactNode
	isCopyTooltipPinned?: boolean
}) {
	return (
		<div className="relative">
			<CodeBlock className={cn('bg-background/80 backdrop-blur-md', className)}>
				<CodeBlockHeader className="border-b pb-2">
					<CodeBlockTitle className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
						Paste into your agent harness
					</CodeBlockTitle>
					<CodeBlockActions>
						{action}
						<CopyButton
							text={startPrompt}
							label="Agent prompt"
							copyLabel="Copy prompt"
							variant="outline"
							isTooltipPinned={isCopyTooltipPinned}
						/>
					</CodeBlockActions>
				</CodeBlockHeader>
				<CodeBlockContent wrap>{startPrompt}</CodeBlockContent>
			</CodeBlock>
			{copyHint ? (
				<span className="pointer-events-none absolute top-2.5 left-full ml-2.5 sm:ml-3">
					{copyHint}
				</span>
			) : null}
		</div>
	)
}

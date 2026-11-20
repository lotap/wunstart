import {Check, Copy} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'

import {Button, type ButtonProps} from '#/components/ui/button.tsx'
import {toast} from '#/components/ui/toast.tsx'
import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'

/**
 * Copy through the Clipboard API when the browser exposes it, otherwise fall
 * back to the selection-based command. iOS Safari only exposes
 * `navigator.clipboard` in a secure context, so a page served over plain HTTP
 * on the local network has no Clipboard API at all.
 */
async function copyText(text: string) {
	try {
		await navigator.clipboard.writeText(text)

		return
	} catch {
		// The Clipboard API is missing in insecure contexts, and may reject a write.
	}

	if (!copyTextWithSelection(text)) {
		throw new Error('Copy command was rejected')
	}
}

/** Legacy copy path; still the only one available in an insecure context. */
function copyTextWithSelection(text: string) {
	const selection = document.getSelection()
	const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null

	const activeElement =
		document.activeElement instanceof HTMLElement ? document.activeElement : null

	const container = document.createElement('div')
	const span = document.createElement('span')

	container.style.position = 'fixed'
	container.style.top = '0'
	container.style.left = '0'
	container.style.opacity = '0'
	container.style.pointerEvents = 'none'
	container.style.userSelect = 'text'
	span.textContent = text
	container.appendChild(span)
	document.body.appendChild(container)

	const range = document.createRange()
	range.selectNodeContents(span)
	selection?.removeAllRanges()
	selection?.addRange(range)

	let copied = false

	const handleCopy = (event: ClipboardEvent) => {
		if (!event.clipboardData) return

		event.clipboardData.setData('text/plain', text)
		event.preventDefault()
		copied = true
	}

	document.addEventListener('copy', handleCopy)

	try {
		copied = document.execCommand('copy') || copied
	} finally {
		document.removeEventListener('copy', handleCopy)
		container.remove()

		if (previousRange && selection) {
			selection.removeAllRanges()
			selection.addRange(previousRange)
		}

		activeElement?.focus({preventScroll: true})
	}

	return copied
}

export function CopyButton({
	text,
	label,
	copyLabel = 'Copy',
	variant = 'ghost',
	isTooltipPinned = false,
}: {
	text: string
	label: string
	copyLabel?: string
	variant?: ButtonProps['variant']
	/** Keep the tooltip open until the caller releases it. */
	isTooltipPinned?: boolean
}) {
	const [copied, setCopied] = useState(false)
	const [tooltipOpen, setTooltipOpen] = useState(false)
	const [tooltipText, setTooltipText] = useState(copyLabel)
	const resetTimeout = useRef<number | null>(null)

	useEffect(() => {
		return () => {
			if (resetTimeout.current !== null) window.clearTimeout(resetTimeout.current)
		}
	}, [])

	return (
		<>
			<Tooltip
				open={copied || tooltipOpen || isTooltipPinned}
				onOpenChange={setTooltipOpen}
				onOpenChangeComplete={(open) => {
					if (!open) setTooltipText(copyLabel)
				}}
			>
				<TooltipTrigger
					delay={300}
					closeOnClick={false}
					render={
						<Button
							type="button"
							variant={variant}
							size="icon-xs"
							aria-label={copied ? 'Copied to clipboard' : `${copyLabel}: ${label}`}
							onClick={async () => {
								try {
									await copyText(text)
									setCopied(true)
									setTooltipText('Copied')

									if (resetTimeout.current !== null) {
										window.clearTimeout(resetTimeout.current)
									}

									resetTimeout.current = window.setTimeout(() => {
										resetTimeout.current = null
										setCopied(false)
										setTooltipOpen(false)
									}, 2000)
								} catch {
									toast.add({title: 'Could not copy to clipboard', type: 'error'})
								}
							}}
						>
							{copied ? <Check /> : <Copy />}
						</Button>
					}
				/>
				<TooltipContent side="top" className="motion-reduce:animate-none!">
					{tooltipText}
				</TooltipContent>
			</Tooltip>
			{copied && <output className="sr-only">Copied to clipboard</output>}
		</>
	)
}

import {Pin} from 'lucide-react'

import {Button, type ButtonProps} from '#/components/ui/button.tsx'
import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'

export function PinButton({
	isPinned,
	label,
	onToggle,
	variant,
	size,
	className,
}: {
	isPinned: boolean
	label: string
	onToggle: () => void
} & Required<Pick<ButtonProps, 'variant' | 'size' | 'className'>>) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant={variant}
						size={size}
						className={className}
						onClick={onToggle}
						aria-label={
							isPinned ? `Unpin ${label}` : `Pin ${label} to keep it open as you navigate settings`
						}
						aria-pressed={isPinned}
					>
						<Pin />
					</Button>
				}
			/>
			<TooltipContent>
				{isPinned ? (
					<strong>Unpin {label}</strong>
				) : (
					<p>
						<strong>Pin {label}</strong> to keep it open as you navigate settings
					</p>
				)}
			</TooltipContent>
		</Tooltip>
	)
}

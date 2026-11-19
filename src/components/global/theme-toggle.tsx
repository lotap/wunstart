import {cn} from 'cn'
import {Moon, Sun} from 'lucide-react'

import {Button} from '#/components/ui/button.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'
import {useTheme, type ThemeContextState} from '#/contexts/theme.tsx'

const toggleResolved = (resolved: ThemeContextState['resolved']) =>
	resolved === 'light' ? 'dark' : 'light'

export default function ThemeToggle({
	size = 'icon-lg',
	label,
	className,
}: {
	size?: 'icon-sm' | 'icon-lg'
	/** Visible label; makes the whole row the toggle and drops the tooltip. */
	label?: string
	className?: string
}) {
	const {theme, resolved, setTheme} = useTheme()

	if (!theme) return <Skeleton className={cn(label ? 'h-11 rounded-lg' : 'size-9', className)} />

	function toggleMode() {
		const nextMode = theme !== 'system' ? 'system' : toggleResolved(resolved)
		setTheme(nextMode)
	}

	const button = (
		<Button
			variant="ghost"
			onClick={toggleMode}
			size={label ? 'default' : size}
			aria-label={`Switch to: ${toggleResolved(resolved)} Mode`}
			className={cn(label && 'gap-2 text-muted-foreground', className)}
		>
			{label && <span>{label}</span>}
			{resolved === 'dark' && <Moon />}
			{resolved === 'light' && <Sun />}
		</Button>
	)

	if (label) return button

	return (
		<Tooltip>
			<TooltipTrigger render={button} />
			<TooltipContent>
				<p>
					Switch to: <strong className="capitalize">{toggleResolved(resolved)} Mode</strong>
				</p>
			</TooltipContent>
		</Tooltip>
	)
}

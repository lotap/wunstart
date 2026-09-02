import {Moon, Sun} from 'lucide-react'

import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'
import {useTheme, type ThemeContextState} from '#/contexts/theme.tsx'
import {Button} from '@/components/ui/button.tsx'

import {Skeleton} from './ui/skeleton.tsx'

const toggleResolved = (resolved: ThemeContextState['resolved']) =>
	resolved === 'light' ? 'dark' : 'light'

export default function ThemeToggle() {
	const {theme, resolved, setTheme} = useTheme()

	if (!theme) return <Skeleton className="size-10" />

	function toggleMode() {
		const nextMode = theme !== 'system' ? 'system' : toggleResolved(resolved)
		setTheme(nextMode)
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant="ghost"
						onClick={toggleMode}
						size="icon-lg"
						aria-label={`Switch to: ${toggleResolved(resolved)} Mode`}
					>
						{resolved === 'dark' && <Moon />}
						{resolved === 'light' && <Sun />}
					</Button>
				}
			/>
			<TooltipContent>
				<p>
					Switch to: <strong className="capitalize">{toggleResolved(resolved)} Mode</strong>
				</p>
			</TooltipContent>
		</Tooltip>
	)
}

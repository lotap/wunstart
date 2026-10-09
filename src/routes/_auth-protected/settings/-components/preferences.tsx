import {Monitor, Moon, Sun} from 'lucide-react'

import {Field, FieldDescription, FieldLabel} from '#/components/ui/field.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {ToggleGroup, ToggleGroupItem} from '#/components/ui/toggle-group.tsx'
import {useTheme, type Theme} from '#/contexts/theme.tsx'

const themeOptions = [
	{
		id: 'system',
		label: 'System',
		description: 'The theme will switch automatically based on your device settings',
		Icon: Monitor,
	},
	{id: 'light', label: 'Light', description: 'Light mode will always be used', Icon: Sun},
	{id: 'dark', label: 'Dark', description: 'Dark mode will always be used', Icon: Moon},
] as const

const ThemeOptions = () =>
	themeOptions.map(({id, label, Icon}) => (
		<ToggleGroupItem
			key={id}
			value={id}
			aria-label={label}
			className="flex size-16 flex-col rounded-md"
		>
			<Icon className="size-5" />
			<span className="text-xs text-muted-foreground">{label}</span>
		</ToggleGroupItem>
	))

function ThemeSelector() {
	const {theme, setTheme} = useTheme()

	return (
		<Field>
			<FieldLabel className="text-muted-foreground">Theme</FieldLabel>
			<div className="flex flex-col gap-2">
				{theme ? (
					<>
						<ToggleGroup
							value={[theme]}
							// SAFETY: single-select group yields pressed values from themeOptions; an empty change keeps the current theme instead of clearing it
							onValueChange={(value) => setTheme((value[0] ?? theme) as Theme)}
							className="max-w-fit items-center justify-center gap-1 rounded-xl border p-1"
						>
							<ThemeOptions />
						</ToggleGroup>
						<FieldDescription>
							{themeOptions.find((option) => option.id === theme)?.description}
						</FieldDescription>
					</>
				) : (
					<>
						{/** Sizes match the loaded toggle group (three size-16 tiles + gaps + padding) and description line so the load never shifts layout */}
						<Skeleton className="h-18.5 w-52.5" />
						<Skeleton className="h-5.25 w-full max-w-md" />
					</>
				)}
			</div>
		</Field>
	)
}

export function Preferences() {
	return <ThemeSelector />
}

import {Monitor, Moon, Sun} from 'lucide-react'
import type React from 'react'

import {Field, FieldDescription, FieldLabel} from '#/components/ui/field.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {ToggleGroup, ToggleGroupItem} from '#/components/ui/toggle-group.tsx'
import {useTheme, type Theme} from '#/contexts/theme.tsx'

const themeOptionsList = [
	[
		'system',
		{
			label: 'System',
			description: 'The theme will switch automatically based on your device settings',
			Icon: Monitor,
		},
	],
	['light', {label: 'Light', description: 'Light Mode will always be used', Icon: Sun}],
	['dark', {label: 'Dark', description: 'Dark Mode will always be used', Icon: Moon}],
] as const

const themeOptionsMap = new Map<
	Theme,
	{Icon: React.ExoticComponent; label: string; description: string}
>(themeOptionsList)

const ThemeOptions = () =>
	themeOptionsList.map(([id, {label, Icon}]) => (
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
			<FieldLabel>Theme</FieldLabel>
			{theme ? (
				<>
					<ToggleGroup
						value={[theme]}
						// SAFETY: the value comes from the themeOptionsList
						onValueChange={(value) => setTheme(value[0] as Theme)}
						className="max-w-fit items-center justify-center gap-1 rounded-xl border p-1"
					>
						<ThemeOptions />
					</ToggleGroup>
					<FieldDescription>{themeOptionsMap.get(theme)?.description}</FieldDescription>
				</>
			) : (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-18.5 w-52.5" />
					<Skeleton className="h-5.25 w-md" />
				</div>
			)}
		</Field>
	)
}

export function Preferences() {
	return <ThemeSelector />
}

import {Schema} from 'effect'
import {createContext, useContext, useMemo, type PropsWithChildren} from 'react'

import {useLocalStorageQuery} from '#/hooks/use-local-storage-query.ts'

const ThemeSchema = Schema.Union([
	Schema.Literal('dark'),
	Schema.Literal('light'),
	Schema.Literal('system'),
])

type Theme = (typeof ThemeSchema)['Type']

export type ThemeContextState = {
	theme: Theme | null
	resolved: Exclude<Theme, 'system'>
	setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextState | null>(null)

const resolveTheme = (theme: Theme | null) => {
	if (theme === 'dark' || theme === 'light') return theme
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({children}: PropsWithChildren) {
	const {
		query: {data: storedTheme, isPending},
		mutation: {mutate: setTheme},
	} = useLocalStorageQuery({key: 'theme', schema: ThemeSchema})

	const theme = isPending ? null : (storedTheme ?? 'system')

	/** Default to light theme on server render, where localstorage and prefers-color-scheme are not available. */
	const resolved = import.meta.env.SSR ? 'light' : resolveTheme(theme)

	const value = useMemo(() => ({theme, resolved, setTheme}), [theme, resolved, setTheme])

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
	const context = useContext(ThemeContext)
	if (!context) throw new Error('useTheme must be used within a ThemeProvider')

	return context
}

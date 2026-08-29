import {
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
} from 'react'

import {isFuture} from '#/lib/date-helpers.ts'

type HasSudoContextState = {
	hasSudo: boolean
	setSudoExpiresAt: Dispatch<SetStateAction<Date | null>>
}

const HasSudoContext = createContext<HasSudoContextState | null>(null)

export function HasSudoProvider({
	children,
	initialSudoExpiresAt,
}: PropsWithChildren<{initialSudoExpiresAt?: Date}>) {
	const [sudoExpiresAt, setSudoExpiresAt] = useState(initialSudoExpiresAt ?? null)

	const hasSudo = !!sudoExpiresAt && isFuture(sudoExpiresAt)

	useEffect(() => {
		if (!sudoExpiresAt) return

		const timeRemaining = sudoExpiresAt.getTime() - Date.now()

		if (timeRemaining <= 0) return

		const timer = setTimeout(() => setSudoExpiresAt(null), timeRemaining)

		return () => clearTimeout(timer)
	}, [sudoExpiresAt])

	const value = useMemo(() => ({hasSudo, setSudoExpiresAt}), [hasSudo])

	return <HasSudoContext.Provider value={value}>{children}</HasSudoContext.Provider>
}

export function useHasSudo() {
	const context = useContext(HasSudoContext)
	if (!context) throw new Error('useHasSudo must be used within a HasSudoProvider')

	return context
}

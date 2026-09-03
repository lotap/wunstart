import {DateTime} from 'effect'
import {
	createContext,
	useContext,
	useEffect,
	useState,
	type Dispatch,
	type PropsWithChildren,
	type SetStateAction,
} from 'react'

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

	const hasSudo = !!sudoExpiresAt && DateTime.isFutureUnsafe(DateTime.makeUnsafe(sudoExpiresAt))

	useEffect(() => {
		if (!sudoExpiresAt) return

		const timeRemaining = sudoExpiresAt.getTime() - Date.now()

		if (timeRemaining <= 0) return

		const timer = setTimeout(() => setSudoExpiresAt(null), timeRemaining)

		return () => clearTimeout(timer)
	}, [sudoExpiresAt])

	const value = {hasSudo, setSudoExpiresAt}

	return <HasSudoContext.Provider value={value}>{children}</HasSudoContext.Provider>
}

export function useHasSudo() {
	const context = useContext(HasSudoContext)
	if (!context) throw new Error('useHasSudo must be used within a HasSudoProvider')

	return context
}

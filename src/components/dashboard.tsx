import {useLocation} from '@tanstack/react-router'
import {lazy, Suspense} from 'react'

const WelcomeDrawerContent = lazy(() =>
	import('./welcome-drawer.tsx').then((m) => ({default: m.WelcomeDrawer})),
)

export function Dashboard() {
	const {state: historyState} = useLocation()

	return (
		<div>
			<h2>dashboard</h2>
			{historyState.welcome && (
				<Suspense>
					<WelcomeDrawerContent />
				</Suspense>
			)}
		</div>
	)
}

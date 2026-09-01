import {useLocation} from '@tanstack/react-router'
import {lazy, Suspense} from 'react'

import {ErrorBoundary} from './error-boundary.tsx'

const WelcomeDrawerContent = lazy(() =>
	import('./welcome-drawer.tsx').then((m) => ({default: m.WelcomeDrawer})),
)

export function Dashboard() {
	const {state: historyState} = useLocation()

	return (
		<div>
			<h2>dashboard</h2>
			{historyState.welcome && (
				<ErrorBoundary>
					<Suspense>
						<WelcomeDrawerContent />
					</Suspense>
				</ErrorBoundary>
			)}
		</div>
	)
}

import {useLocation} from '@tanstack/react-router'
import {lazy} from 'react'

import {AsyncBoundary} from '#/components/global/async-boundary.tsx'

const WelcomeDrawerContent = lazy(() =>
	import('./welcome-drawer.tsx').then((m) => ({default: m.WelcomeDrawer})),
)

export function Dashboard() {
	const {state: historyState} = useLocation()

	return (
		<div className="mx-auto max-w-5xl p-2">
			<h1 className="font-heading">Dashboard</h1>
			{historyState.welcome && (
				<AsyncBoundary fallback={null}>
					<WelcomeDrawerContent />
				</AsyncBoundary>
			)}
		</div>
	)
}

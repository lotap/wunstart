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
			<h2 className="font-heading">dashboard</h2>
			{historyState.welcome && (
				<AsyncBoundary fallback={null}>
					<WelcomeDrawerContent />
				</AsyncBoundary>
			)}
		</div>
	)
}

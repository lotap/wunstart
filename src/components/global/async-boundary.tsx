import {Suspense} from 'react'
import type {ReactNode} from 'react'

import {ErrorBoundary} from './error-boundary.tsx'

/**
 * Wraps a lazy or async subtree in both an ErrorBoundary and a Suspense boundary so a
 * failed query or chunk load degrades to `errorFallback` instead of escaping to the
 * route-level boundary and unmounting the surrounding page.
 */
export function AsyncBoundary({
	children,
	fallback = null,
	errorFallback,
}: {
	children: ReactNode
	fallback?: ReactNode
	errorFallback?: ReactNode
}) {
	return (
		<ErrorBoundary fallback={errorFallback}>
			<Suspense fallback={fallback}>{children}</Suspense>
		</ErrorBoundary>
	)
}

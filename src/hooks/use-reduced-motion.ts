import {useSyncExternalStore} from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onStoreChange: () => void) {
	const query = window.matchMedia(QUERY)

	query.addEventListener('change', onStoreChange)

	return () => query.removeEventListener('change', onStoreChange)
}

function getSnapshot() {
	return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
	return false
}

/** Track the user’s reduced-motion preference. */
export function useReducedMotion() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

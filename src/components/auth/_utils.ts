import {queryOptions, type QueryClient} from '@tanstack/react-query'
import type {useServerFn} from '@tanstack/react-start'
import {Result, Schema} from 'effect'

import type {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

export const LocalStorageEmailSchema = Schema.Struct({
	email: Schema.String, // Does not use Email schema because it should incomplete addresses
	expiresAt: Schema.DateTimeUtcFromString,
})

export const LocalStorageAuthFormStateSchema = Schema.Struct({
	step: Schema.Finite,
	expiresAt: Schema.DateTimeUtcFromString,
})

/** The server function that requests a code email. Closed over its inputs, so callers invoke it with no arguments */
export type RequestEmailPasscodeServerFn = () => Promise<{expiresAt: Date}>

export const passcodeRequestQueryOptions = ({
	serverFn,
	email,
	intent,
}: {
	serverFn: RequestEmailPasscodeServerFn
	email: string
	intent: 'sign-up' | 'sign-in' | 'reverify'
}) =>
	queryOptions({
		queryKey: ['passcodeRequest', email, intent],
		queryFn: () => serverFn(),
		select: (data) =>
			Result.getOrThrow(
				Schema.decodeResult(Schema.Struct({expiresAt: Schema.DateTimeUtcFromDate}))(data),
			),
		staleTime: ({state: {data}}) => (data ? data.expiresAt.getTime() - Date.now() : 60 * 1000),
		gcTime: 15 * 60 * 1000,
		enabled: false,
	})

export type PasscodeRequestQueryOptions = ReturnType<typeof passcodeRequestQueryOptions>

export const userProfileQueryOptions = ({
	serverFn,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleGetUserProfile>>
}) =>
	queryOptions({
		queryKey: ['userProfile'],
		queryFn: () => serverFn(),
		staleTime: Infinity,
	})

/**
 * Storage key used to tell other tabs that the signed-in identity changed.
 * Auth cookies are shared across tabs; React Query is not.
 */
export const authTransitionStorageKey = 'auth-identity-transition'

/**
 * Drop every cached query when the signed-in identity changes.
 *
 * React Query keeps data across route changes, so without this the next user
 * can see the previous identity’s session list, profile, or email, and an
 * in-flight fetch from the old identity can settle into the new mount.
 * `clear()` instead of a key list: profile already uses `staleTime: Infinity`,
 * and a future identity-scoped query must not be forgotten.
 *
 * Also leave a storage marker: cookies are shared across tabs, so other open
 * tabs clear their cache and refresh the router through `useAuthCacheSync`.
 */
export function clearIdentityCache(queryClient: QueryClient) {
	queryClient.clear()

	if (typeof window === 'undefined') return

	try {
		/**
		 * Only needs to change. Avoid `crypto.randomUUID()`: it is unavailable
		 * in insecure contexts such as an HTTP LAN preview, where the swallowed
		 * error would silently disable cross-tab sync.
		 */
		window.localStorage.setItem(
			authTransitionStorageKey,
			`${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
		)
	} catch {
		/** Storage can be unavailable; the current tab is already cleared. */
	}
}

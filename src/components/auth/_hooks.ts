import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useRouter} from '@tanstack/react-router'
import {DateTime} from 'effect'
import {useEffect, useState} from 'react'

import {useLocalStorageQuery} from '#/hooks/use-local-storage-query.ts'
import {SESSION_EXPIRED_MESSAGE} from '#/isomorphic/auth-messages.ts'
import type {PasswordStrength} from '#/isomorphic/password-strength.ts'
import {checkPasswordStrength} from '#/isomorphic/password-strength.ts'

import {
	passcodeRequestQueryOptions,
	LocalStorageAuthFormStateSchema,
	LocalStorageEmailSchema,
	type RequestEmailPasscodeServerFn,
	type PasscodeRequestQueryOptions,
} from './_utils.ts'
import {clearIdentityCache} from './identity-cache.ts'

/**
 * Recover the client after a protected mutation finds the session gone.
 *
 * `runOpClearingDeadSession` ends the dead cookie pair server-side and rethrows
 * the session-expired message, but the router context and cached identity
 * survive until the next navigation. Clear both here so the guard can redirect
 * immediately.
 *
 * Act on that message alone. A `requireAuth` 401 merely says this request had no
 * usable identity: `verifyAuth` keeps the cookie pair when a ban or rate limit
 * refused the refresh, so the session behind it may still be alive. Surfacing
 * that error in place leaves the retained pair to restore the identity once the
 * refusal lifts. Paths that keep the pair on failure — `signOutAll`, a refused
 * refresh — use different copy for the same reason. Every other error passes
 * through.
 */
export function useDeadSessionRecovery() {
	const queryClient = useQueryClient()
	const router = useRouter()

	return (cause: unknown) => {
		if (!(cause instanceof Error)) return

		if (cause.message !== SESSION_EXPIRED_MESSAGE) return

		clearIdentityCache(queryClient)
		void router.invalidate().catch(() => undefined)
	}
}

export function useLocalStorageEmail() {
	const queries = useLocalStorageQuery({key: 'auth-email', schema: LocalStorageEmailSchema})

	return queries
}

export function usePasscodeRequestMutation({
	serverFn,
	invalidationKey,
}: {
	serverFn: RequestEmailPasscodeServerFn
	invalidationKey: PasscodeRequestQueryOptions['queryKey']
}) {
	const queryClient = useQueryClient()

	const {mutateAsync: mutatePasscodeRequest, isPending: passcodeRequestIsPending} = useMutation({
		mutationFn: serverFn,
		gcTime: 15 * 60 * 1000,
		onSuccess: ({expiresAt, resendAvailableAt}) =>
			queryClient.setQueryData(invalidationKey, {expiresAt, resendAvailableAt}),
	})

	return {mutatePasscodeRequest, passcodeRequestIsPending}
}

/** Email-capture and passcode-request state for the auth flow. */
export function useAuthFormEmailState({
	serverFn,
	email,
	intent,
}: {
	serverFn: RequestEmailPasscodeServerFn
	email: string
	intent: 'sign-up' | 'sign-in' | 'reverify'
}) {
	const {
		query: {isPending: localStorageEmailIsPending},
		mutation: {mutate: upsertLocalStorageEmail},
	} = useLocalStorageEmail()

	const passcodeRequestOptions = passcodeRequestQueryOptions({
		serverFn,
		email,
		intent,
	})

	const {mutatePasscodeRequest, passcodeRequestIsPending} = usePasscodeRequestMutation({
		serverFn,
		invalidationKey: passcodeRequestOptions.queryKey,
	})

	const handleEmailChange = (value: string) => {
		upsertLocalStorageEmail({
			email: value,
			expiresAt: DateTime.nowUnsafe().pipe(DateTime.add({hours: 24})),
		})
	}

	return {
		localStorageEmailIsPending,
		passcodeRequestOptions,
		mutatePasscodeRequest,
		passcodeRequestIsPending,
		handleEmailChange,
	}
}

export function useLocalStorageAuthFormState({key}: {key: string}) {
	const {query, mutation, remove} = useLocalStorageQuery({
		key,
		schema: LocalStorageAuthFormStateSchema,
	})

	const step = query.data?.step ?? 0

	const setStep = (_step: number) => {
		mutation.mutate({
			step: _step,
			expiresAt: DateTime.nowUnsafe().pipe(DateTime.add({hours: 24})),
		})
	}

	const isPending = query.isPending

	return {step, setStep, isPending, remove}
}

/**
 * Non-sensitive profile identifiers used to penalize a password that contains
 * them. Add a field here and to the effect below; see `checkPasswordStrength`
 * for the server-side strictness rule.
 */
export type PasswordStrengthContext = {
	email?: string
}

/**
 * Live zxcvbn strength for a password value, debounced so the dictionaries
 * are not checked on every keystroke. Returns the latest settled score — the
 * previous one during the debounce window — or null while the value is empty
 * or no check has landed yet
 */
export function usePasswordStrength(value: string, {email}: PasswordStrengthContext = {}) {
	const [strength, setStrength] = useState<PasswordStrength | null>(null)

	useEffect(() => {
		if (!value) return

		let isStale = false

		/** Debounced so zxcvbn does not run on every keystroke while typing */
		const timeout = setTimeout(() => {
			checkPasswordStrength(value, email ? [email] : [])
				.then((result) => {
					if (!isStale) setStrength(result)
				})
				.catch(() => {
					/**
					 * Strength gates the submit button, so a failed check clears the
					 * score and keeps it disabled; the next keystroke retries, and the
					 * server re-check stays authoritative
					 */
					if (!isStale) setStrength(null)
				})
		}, 200)

		return () => {
			isStale = true
			clearTimeout(timeout)
		}
	}, [value, email])

	return value ? strength : null
}

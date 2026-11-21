import {useMutation, useQueryClient} from '@tanstack/react-query'
import {DateTime} from 'effect'
import {useEffect, useState} from 'react'

import {useLocalStorageQuery} from '#/hooks/use-local-storage-query.ts'
import type {PasswordStrength} from '#/isomorphic/password-strength.ts'
import {checkPasswordStrength} from '#/isomorphic/password-strength.ts'

import {
	passcodeRequestQueryOptions,
	LocalStorageAuthFormStateSchema,
	LocalStorageEmailSchema,
	type RequestEmailPasscodeServerFn,
	type PasscodeRequestQueryOptions,
} from './_utils.ts'

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
		onSuccess: ({expiresAt}) => queryClient.setQueryData(invalidationKey, {expiresAt}),
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

/** Stable identity for the default so the effect below never re-runs on render */
const NO_USER_INPUTS: Array<string> = []

/**
 * Live zxcvbn strength for a password value, debounced so the dictionaries
 * are not checked on every keystroke. Returns the latest settled score — the
 * previous one during the debounce window — or null while the value is empty
 * or no check has landed yet
 */
export function usePasswordStrength(value: string, userInputs: Array<string> = NO_USER_INPUTS) {
	const [strength, setStrength] = useState<PasswordStrength | null>(null)

	useEffect(() => {
		if (!value) return

		let isStale = false

		/** Debounced so zxcvbn does not run on every keystroke while typing */
		const timeout = setTimeout(() => {
			checkPasswordStrength(value, userInputs)
				.then((result) => {
					if (!isStale) setStrength(result)
				})
				.catch(() => {
					/**
					 * Strength gates the submit button, so a failed check keeps it
					 * disabled; the next keystroke retries, and the server re-check
					 * stays authoritative
					 */
				})
		}, 200)

		return () => {
			isStale = true
			clearTimeout(timeout)
		}
	}, [value, userInputs])

	return value ? strength : null
}

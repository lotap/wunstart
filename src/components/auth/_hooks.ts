import {useMutation, useQueryClient} from '@tanstack/react-query'
import {DateTime} from 'effect'

import {useLocalStorageQuery} from '#/hooks/use-local-storage-query.ts'

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

/** Shared email-capture state for the sign-in and sign-up forms */
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

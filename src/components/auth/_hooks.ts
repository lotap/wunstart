import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import {DateTime} from 'effect'

import {useLocalStorageQuery} from '#/hooks/use-local-storage-query.ts'
import {handleEmailRequestVerification} from '#/server-fns/handle-email-request-verification.ts'

import {
	emailRequestVerificationQueryOptions,
	LocalStorageAuthFormStateSchema,
	LocalStorageEmailSchema,
	type EmailRequestVerificationQueryOptions,
} from './_utils.ts'

export function useLocalStorageEmail() {
	const queries = useLocalStorageQuery({key: 'auth-email', schema: LocalStorageEmailSchema})
	return queries
}

export function useEmailRequestVerificationMutation({
	serverFn,
	invalidationKey,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleEmailRequestVerification>>
	invalidationKey: EmailRequestVerificationQueryOptions['queryKey']
}) {
	const queryClient = useQueryClient()

	const {
		mutateAsync: mutateEmailRequestVerification,
		isPending: emailRequestVerificationIsPending,
	} = useMutation({
		mutationFn: (data: {email: string; expectRegisteredRecipient?: boolean}) => serverFn({data}),
		gcTime: 15 * 60 * 1000,
		onSuccess: ({expiresAt}) => queryClient.setQueryData(invalidationKey, {expiresAt}),
	})

	return {mutateEmailRequestVerification, emailRequestVerificationIsPending}
}

/** Shared email-capture state for the sign-in and sign-up forms */
export function useAuthFormEmailState({
	serverFn,
	email,
	expectRegisteredRecipient,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleEmailRequestVerification>>
	email: string
	expectRegisteredRecipient: boolean
}) {
	const {
		query: {isPending: localStorageEmailIsPending},
		mutation: {mutate: upsertLocalStorageEmail},
	} = useLocalStorageEmail()

	const emailRequestVerificationOptions = emailRequestVerificationQueryOptions({
		serverFn,
		email,
		expectRegisteredRecipient,
	})

	const {mutateEmailRequestVerification, emailRequestVerificationIsPending} =
		useEmailRequestVerificationMutation({
			serverFn,
			invalidationKey: emailRequestVerificationOptions.queryKey,
		})

	const handleEmailChange = (value: string) => {
		upsertLocalStorageEmail({
			email: value,
			expiresAt: DateTime.nowUnsafe().pipe(DateTime.add({hours: 24})),
		})
	}

	return {
		localStorageEmailIsPending,
		emailRequestVerificationOptions,
		mutateEmailRequestVerification,
		emailRequestVerificationIsPending,
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

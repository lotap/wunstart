import {useMutation, useQueryClient} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'
import {DateTime} from 'effect'

import {useLocalStorageQuery} from '#/hooks/use-local-storage-query.ts'
import {handleEmailRequestVerification} from '#/server-fns/handle-email-request-verification.ts'

import {
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

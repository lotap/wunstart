import {queryOptions} from '@tanstack/react-query'
import type {useServerFn} from '@tanstack/react-start'
import {Result, Schema} from 'effect'

import type {handleEmailRequestVerification} from '#/server-fns/handle-email-request-verification.ts'

export const LocalStorageEmailSchema = Schema.Struct({
	email: Schema.String, // Does not use Email schema because it should incomplete addresses
	expiresAt: Schema.DateTimeUtcFromString,
})

export const LocalStorageAuthFormStateSchema = Schema.Struct({
	step: Schema.Finite,
	expiresAt: Schema.DateTimeUtcFromString,
})

export const emailRequestVerificationQueryOptions = ({
	serverFn,
	email,
	expectRegisteredRecipient,
}: {
	serverFn: ReturnType<typeof useServerFn<typeof handleEmailRequestVerification>>
	email: string
	expectRegisteredRecipient?: boolean
}) =>
	queryOptions({
		queryKey: [
			'emailRequestVerification',
			email,
			`expectRegisteredRecipient-${expectRegisteredRecipient}`,
		],
		queryFn: () => serverFn({data: {email, expectRegisteredRecipient}}),
		select: (data) =>
			Result.getOrThrow(
				Schema.decodeUnknownResult(Schema.Struct({expiresAt: Schema.DateTimeUtcFromDate}))(data),
			),
		staleTime: ({state: {data}}) => (data ? data.expiresAt.getTime() - Date.now() : 60 * 1000),
		gcTime: 15 * 60 * 1000,
		enabled: false,
	})

export type EmailRequestVerificationQueryOptions = ReturnType<
	typeof emailRequestVerificationQueryOptions
>

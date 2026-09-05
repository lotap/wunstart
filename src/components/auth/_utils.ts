import {queryOptions} from '@tanstack/react-query'
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
				Schema.decodeUnknownResult(Schema.Struct({expiresAt: Schema.DateTimeUtcFromDate}))(data),
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

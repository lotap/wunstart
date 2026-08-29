import {queryOptions, useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {DateTime, Result, Schema} from 'effect'
import type {ConstraintDecoder} from 'effect/Schema'
import {useEffect} from 'react'

type PersistingDataProps<T extends ConstraintDecoder<unknown>> = {
	key: string
	schema: T
}

const Expiry = Schema.Struct({
	expiresAt: Schema.DateTimeUtc,
})

const getLocalStorageItem = <T extends ConstraintDecoder<unknown>>({
	key,
	schema,
}: PersistingDataProps<T>) => {
	/** Get the locally stored data */
	const stateStr = localStorage.getItem(key)

	/** Return null if not found */
	if (!stateStr) return null

	/** Parse the stored JSON string; remove and return null if it's malformed */
	let rawState: unknown
	try {
		rawState = JSON.parse(stateStr)
	} catch {
		localStorage.removeItem(key)
		return null
	}

	/** Parse the stored JSON string with the given schema */
	const parsed = Schema.decodeUnknownResult(schema)(rawState)

	/** If parsing succeeds, check for an expiredAt field */
	if (Result.isSuccess(parsed)) {
		const parsedExpiry = Schema.decodeUnknownResult(Expiry)(parsed.success)

		/** If no expiredAt field or expiredAt is in the future, return the parsed data */
		if (Result.isFailure(parsedExpiry) || DateTime.isFutureUnsafe(parsedExpiry.success.expiresAt)) {
			return parsed.success
		}
	}

	/** Otherwise, delete the bad or expired data and return null */
	localStorage.removeItem(key)
	return null
}

export function useLocalStorageQuery<T extends ConstraintDecoder<unknown>>({
	key,
	schema,
}: PersistingDataProps<T>) {
	const queryClient = useQueryClient()

	const localStorageQueryOptions = queryOptions({
		queryKey: ['localStorage', key],
		queryFn: () => getLocalStorageItem({key, schema}),
		staleTime: Infinity,
		gcTime: 24 * 60 * 60 * 1000, // 24 hrs in ms
	})

	const query = useQuery(localStorageQueryOptions)

	const mutation = useMutation({
		mutationFn: async (data: Partial<T['Type']>) => {
			let newData = null
			if (Schema.is(Schema.String)(data)) {
				newData = data
			} else if (query.isSuccess && query.data) {
				newData = {...query.data, ...data}
			} else {
				const storedData = getLocalStorageItem({key, schema})
				newData = storedData === null ? data : {...storedData, ...data}
			}
			localStorage.setItem(key, JSON.stringify(newData))
			return newData
		},
		onSettled: () => queryClient.invalidateQueries({queryKey: localStorageQueryOptions.queryKey}),
	})

	const remove = () => {
		localStorage.removeItem(key)
		/**
		 * Drop the cached entry so staleTime: Infinity never serves removed
		 * state on the next mount
		 */
		queryClient.removeQueries({queryKey: localStorageQueryOptions.queryKey})
	}

	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === key) {
				void queryClient.invalidateQueries({queryKey: localStorageQueryOptions.queryKey})
			}
		}
		window.addEventListener('storage', handleStorage)
		return () => window.removeEventListener('storage', handleStorage)
	}, [key, queryClient, localStorageQueryOptions.queryKey])

	return {query, mutation, remove}
}

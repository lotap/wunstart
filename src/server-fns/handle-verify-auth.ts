import {createServerFn} from '@tanstack/react-start'
import {DateTime} from 'effect'

export const handleVerifyAuth = createServerFn({method: 'POST'}).handler(
	async ({context: {auth}}) => {
		if (!auth) return null

		const {sudoExpiresAt} = auth

		/**
		 * The client never receives db ids; server fns unwrap the identity from
		 * the cookie and only return client-relevant state
		 */
		return {sudoExpiresAt: sudoExpiresAt ? DateTime.toDate(sudoExpiresAt) : undefined}
	},
)

import {createServerFn} from '@tanstack/react-start'
import {DateTime} from 'effect'

export const handleVerifyAuth = createServerFn({method: 'POST'}).handler(
	async ({context: {auth}}) => {
		if (!auth) return null

		const {userId, sudoExpiresAt} = auth

		return {userId, sudoExpiresAt: sudoExpiresAt ? DateTime.toDate(sudoExpiresAt) : undefined}
	},
)

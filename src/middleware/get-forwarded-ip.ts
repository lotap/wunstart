import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'

/** Cap matching the UserAgent validation, so hostile headers can't fail ops downstream */
const USER_AGENT_MAX_LENGTH = 512

export const getForwardedIp = createMiddleware().server(({next}) => {
	const ipAddress =
		getRequestHeader('cf-connecting-ip') ?? getRequestIP({xForwardedFor: true}) ?? '0.0.0.0'

	const userAgent = (getRequestHeader('user-agent') ?? 'unknown')
		.trim()
		.slice(0, USER_AGENT_MAX_LENGTH)

	return next({context: {ipAddress, userAgent}})
})

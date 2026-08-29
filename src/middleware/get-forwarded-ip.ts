import {createMiddleware} from '@tanstack/react-start'
import {getRequestHeader, getRequestIP} from '@tanstack/react-start/server'

export const getForwardedIp = createMiddleware().server(({next}) => {
	const ipAddress =
		getRequestHeader('cf-connecting-ip') ?? getRequestIP({xForwardedFor: true}) ?? '0.0.0.0'

	return next({context: {ipAddress}})
})

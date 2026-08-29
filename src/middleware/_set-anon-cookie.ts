import {setCookie} from '@tanstack/react-start/server'

import {addWeeks} from '#/lib/date-helpers.ts'

export const ANON_TOKEN_COOKIE_NAME = `${import.meta.env.PROD ? '__Http-' : ''}anon`

export const anonCookieConfig = {
	httpOnly: true,
	sameSite: 'lax',
	path: '/',
	secure: import.meta.env.PROD,
	domain: import.meta.env.VITE_COOKIE_DOMAIN,
} as const

export function setAnonCookie(token: string) {
	setCookie(ANON_TOKEN_COOKIE_NAME, token, {...anonCookieConfig, expires: addWeeks(new Date(), 8)})
}

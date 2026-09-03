import {setCookie} from '@tanstack/react-start/server'
import {DateTime} from 'effect'

export const ANON_TOKEN_COOKIE_NAME = `${import.meta.env.PROD ? '__Http-' : ''}anon`

export const anonCookieConfig = {
	httpOnly: true,
	sameSite: 'lax',
	path: '/',
	secure: import.meta.env.PROD,
	domain: import.meta.env.VITE_COOKIE_DOMAIN,
} as const

export function setAnonCookie(token: string) {
	setCookie(ANON_TOKEN_COOKIE_NAME, token, {
		...anonCookieConfig,
		/** Add weeks and convert back to a Date for the cookie */
		expires: DateTime.nowUnsafe().pipe(DateTime.add({weeks: 8}), DateTime.toDateUtc),
	})
}

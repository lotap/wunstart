import {setCookie} from '@tanstack/react-start/server'
import {DateTime} from 'effect'

import {cookieDomain, cookieName} from './_cookie-config.ts'

export const ANON_TOKEN_COOKIE_NAME = cookieName('anon')

export const anonCookieConfig = {
	httpOnly: true,
	sameSite: 'lax',
	path: '/',
	secure: import.meta.env.PROD,
	domain: cookieDomain,
} as const

export function setAnonCookie(token: string) {
	setCookie(ANON_TOKEN_COOKIE_NAME, token, {
		...anonCookieConfig,
		/** Add weeks and convert back to a Date for the cookie */
		expires: DateTime.nowUnsafe().pipe(DateTime.add({weeks: 8}), DateTime.toDateUtc),
	})
}

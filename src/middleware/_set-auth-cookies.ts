import {deleteCookie, setCookie} from '@tanstack/react-start/server'
import {DateTime} from 'effect'

import {ANON_TOKEN_COOKIE_NAME, anonCookieConfig} from './_set-anon-cookie.ts'

export const ACCESS_TOKEN_COOKIE_NAME = `${import.meta.env.PROD ? '__Http-' : ''}access`
export const REFRESH_TOKEN_COOKIE_NAME = `${import.meta.env.PROD ? '__Http-' : ''}refresh`

export const authCookiesConfig = {
	httpOnly: true,
	sameSite: 'lax',
	path: '/',
	secure: import.meta.env.PROD,
	domain: import.meta.env.VITE_COOKIE_DOMAIN,
} as const

export function setAccessTokenCookie({token, exp}: {token: string; exp: DateTime.Utc}) {
	return setCookie(ACCESS_TOKEN_COOKIE_NAME, token, {
		...authCookiesConfig,
		expires: DateTime.toDate(exp),
	})
}

export function setAuthCookies({
	access,
	session,
}: {
	access: {token: string; exp: DateTime.Utc}
	session: {refreshToken: string; expiresAt: DateTime.Utc}
}) {
	setAccessTokenCookie(access)

	setCookie(REFRESH_TOKEN_COOKIE_NAME, session.refreshToken, {
		...authCookiesConfig,
		expires: DateTime.toDate(session.expiresAt),
	})

	deleteCookie(ANON_TOKEN_COOKIE_NAME, anonCookieConfig)
}

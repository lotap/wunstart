import type {LinkProps} from '@tanstack/react-router'

export type HeaderLink = {
	to: NonNullable<LinkProps['to']>
	label: string
}

/** Add a route here to put it in the signed-out header and panel. */
export const ANON_LINKS: readonly HeaderLink[] = [
	// Examples: replace these with your product’s pages.
	{to: '/landing-page', label: 'Landing page'},
	{to: '/pricing', label: 'Pricing'},
]

/** Add a route here to put it in the signed-in header and panel. */
export const USER_LINKS: readonly HeaderLink[] = []

/** The panel’s auth row; the desktop control is a button-styled link. */
export const SIGN_IN_LINK: HeaderLink = {to: '/sign-in', label: 'Sign in'}

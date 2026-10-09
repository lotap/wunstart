import {CircleUserRound, ShieldCheck, SlidersHorizontal} from 'lucide-react'

/**
 * Settings category metadata, shared by the settings page and the account
 * menu. Kept component-free so menu consumers never pull section code into
 * their bundle; components are attached in `./-components/page.tsx`
 */
export const CATEGORIES = [
	{id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal},
	{id: 'profile', label: 'Profile', Icon: CircleUserRound},
	{id: 'access', label: 'Access & Security', Icon: ShieldCheck},
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

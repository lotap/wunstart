import {CircleUserRound, ShieldCheck, SlidersHorizontal} from 'lucide-react'

/**
 * Settings category metadata. Kept component-free so the page can map ids to
 * section components in `./-components/page.tsx`.
 */
export const CATEGORIES = [
	{id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal},
	{id: 'profile', label: 'Profile', Icon: CircleUserRound},
	{id: 'access', label: 'Access & Security', Icon: ShieldCheck},
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

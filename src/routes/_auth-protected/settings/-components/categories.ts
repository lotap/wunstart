import {CircleUserRound, ShieldCheck, SlidersHorizontal} from 'lucide-react'

import {AccessAndSecurity} from './access-and-security.tsx'
import {Preferences} from './preferences.tsx'
import {Profile} from './profile.tsx'

export const CATEGORIES = [
	{id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal, Component: Preferences},
	{id: 'profile', label: 'Profile', Icon: CircleUserRound, Component: Profile},
	{id: 'access', label: 'Access & Security', Icon: ShieldCheck, Component: AccessAndSecurity},
] as const

export type CatId = (typeof CATEGORIES)[number]['id']

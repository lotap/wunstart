import {CircleUserRound, ShieldCheck, SlidersHorizontal} from 'lucide-react'

/**
 * Account-menu shortcuts into settings. The header chrome owns this list so it
 * never imports a route module; the ids stay literal, so the settings route’s
 * search schema fails the typecheck when a category is renamed.
 */
export const SETTINGS_SHORTCUTS = [
	{id: 'preferences', label: 'Preferences', Icon: SlidersHorizontal},
	{id: 'profile', label: 'Profile', Icon: CircleUserRound},
	{id: 'access', label: 'Access & security', Icon: ShieldCheck},
] as const

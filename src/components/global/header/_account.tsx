import {useQuery} from '@tanstack/react-query'
import {Link} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'

import {userProfileQueryOptions} from '#/components/auth/_utils.ts'
import {Button} from '#/components/ui/button.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {useSignOut} from '#/hooks/use-sign-out.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

import {SETTINGS_SHORTCUTS} from './_settings-shortcuts.ts'

/**
 * The signed-in account block in the drawer: a “Signed in as” label above the
 * profile email, then the settings shortcuts as icon rows. The desktop dropdown
 * shares the shortcut data but keeps its own layout.
 */
export function AccountLinks({open, onNavigate}: {open: boolean; onNavigate: () => void}) {
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {isPending, data: profile} = useQuery({
		...userProfileQueryOptions({serverFn: handleGetUserProfileFn}),
		enabled: open,
	})

	return (
		<div className="flex flex-col">
			<div className="flex flex-col gap-1 pb-1">
				<span className="text-xs text-muted-foreground">Signed in as</span>
				{isPending && <Skeleton className="h-3.5 w-48" />}
				{!isPending && profile && <span className="truncate text-sm">{profile.email}</span>}
			</div>
			{SETTINGS_SHORTCUTS.map(({id, label, Icon}) => (
				<Link
					key={id}
					to="/settings"
					search={{categories: [id]}}
					onClick={onNavigate}
					className="-mx-2 flex h-11 items-center gap-3 rounded-lg px-2 text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset dark:font-normal"
				>
					<Icon aria-hidden="true" className="size-4" />
					{label}
				</Link>
			))}
		</div>
	)
}

/** The signed-in menu’s anchored action, in the slot the auth pair occupies. */
export function AccountSignOut({onNavigate}: {onNavigate: () => void}) {
	const signOut = useSignOut()

	return (
		<Button
			variant="ghost"
			onClick={() => {
				onNavigate()
				void signOut()
			}}
			className="h-14 w-full justify-center rounded-lg px-2 text-base text-muted-foreground dark:font-normal"
		>
			Sign out
		</Button>
	)
}

import {useQuery} from '@tanstack/react-query'
import {Link} from '@tanstack/react-router'
import {useServerFn} from '@tanstack/react-start'
import {LogOut, User} from 'lucide-react'
import {useState} from 'react'

import {userProfileQueryOptions} from '#/components/auth/identity-cache.ts'
import {Button} from '#/components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {useSignOut} from '#/hooks/use-sign-out.ts'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

import {SETTINGS_SHORTCUTS} from './_settings-shortcuts.ts'

export function UserNav() {
	const signOut = useSignOut()
	/**
	 * Always set the initial value to false so it renders closed
	 * This provides a base so that the animate-in can function properly
	 */
	const [open, setOpen] = useState(false)
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {isPending, data: profile} = useQuery({
		...userProfileQueryOptions({serverFn: handleGetUserProfileFn}),
		enabled: open,
	})

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon-lg" aria-label="Account" className="size-10" />}
			>
				<User aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={8} className="min-w-48">
				{(isPending || profile) && (
					<DropdownMenuGroup>
						{isPending ? (
							<DropdownMenuLabel>
								{/** w-24 matches a 14-char masked Gmail address at text-sm */}
								<Skeleton className="h-4 w-24" />
							</DropdownMenuLabel>
						) : (
							<DropdownMenuLabel className="max-w-56 truncate">{profile.email}</DropdownMenuLabel>
						)}
					</DropdownMenuGroup>
				)}
				{(isPending || profile) && <DropdownMenuSeparator />}
				{SETTINGS_SHORTCUTS.map(({id, label, Icon}) => (
					<DropdownMenuItem
						key={id}
						render={<Link to="/settings" search={{categories: [id]}} />}
						className="cursor-pointer"
					>
						<Icon aria-hidden="true" />
						{label}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="cursor-pointer"
					onClick={() => {
						void signOut()
					}}
				>
					<LogOut aria-hidden="true" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

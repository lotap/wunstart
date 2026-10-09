import {useQuery} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'

import {userProfileQueryOptions} from '#/components/auth/_utils.ts'
import {EmailChangeDrawer} from '#/components/auth/email-change.tsx'
import {ErrorBoundary} from '#/components/error-boundary.tsx'
import {Field, FieldContent, FieldLabel} from '#/components/ui/field.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

const ProfileEmailErrMsg = () => (
	<p role="alert" className="text-destructive">
		Could not retrieve your email. Refresh and try again.
	</p>
)

function ProfileEmail() {
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {isPending, data: profile} = useQuery(
		userProfileQueryOptions({serverFn: handleGetUserProfileFn}),
	)

	/** w-28 matches a 14-char masked Gmail address at text-base so the load never shifts layout */
	if (isPending) return <Skeleton className="h-6 w-28" />

	if (profile) return <p className="text-base text-foreground">{profile.email}</p>

	return <ProfileEmailErrMsg />
}

export function Profile() {
	return (
		<Field orientation="responsive">
			<FieldLabel className="text-muted-foreground">Email</FieldLabel>
			<FieldContent className="flex flex-row items-center-safe gap-2">
				<ErrorBoundary fallback={<ProfileEmailErrMsg />}>
					<ProfileEmail />
				</ErrorBoundary>

				<EmailChangeDrawer />
			</FieldContent>
		</Field>
	)
}

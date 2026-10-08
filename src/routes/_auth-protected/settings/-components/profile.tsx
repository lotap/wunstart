import {useQuery} from '@tanstack/react-query'
import {useServerFn} from '@tanstack/react-start'

import {userProfileQueryOptions} from '#/components/auth/_utils.ts'
import {EmailChangeDrawer} from '#/components/auth/email-change.tsx'
import {ErrorBoundary} from '#/components/error-boundary.tsx'
import {Field, FieldContent, FieldDescription, FieldLabel} from '#/components/ui/field.tsx'
import {Skeleton} from '#/components/ui/skeleton.tsx'
import {handleGetUserProfile} from '#/server-fns/handle-get-user-profile.ts'

const ProfileEmailErrMsg = () => (
	<p className="alert">Could not retrieve your email. Refresh and try again.</p>
)

function ProfileEmail() {
	const handleGetUserProfileFn = useServerFn(handleGetUserProfile)

	const {isPending, data: profile} = useQuery(
		userProfileQueryOptions({serverFn: handleGetUserProfileFn}),
	)

	if (isPending) return <Skeleton className="h-6 w-full max-w-3xs" />

	if (profile)
		return (
			<FieldDescription className="mt-0! text-base text-foreground">
				{profile.email}
			</FieldDescription>
		)

	return <ProfileEmailErrMsg />
}

export function Profile() {
	return (
		<Field orientation="responsive">
			<FieldLabel>Email</FieldLabel>
			<FieldContent className="flex flex-row items-center-safe gap-1">
				<ErrorBoundary fallback={<ProfileEmailErrMsg />}>
					<ProfileEmail />
				</ErrorBoundary>

				<EmailChangeDrawer />
			</FieldContent>
		</Field>
	)
}

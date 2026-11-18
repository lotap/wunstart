// @refresh reset

import {appInfo} from '#/app-info.ts'

import {EmailText} from '../components/email-typography.tsx'
import {emailPreview} from '../preview.ts'
import {
	SecurityDetailRows,
	SecurityNotificationLayout,
	renderSecurityNotification,
} from './security-notification.tsx'
import type {SecurityNotificationContext} from './security-notification.tsx'

type SignInNotificationProps = {
	appUrl: string
	occurredAt: Date
} & SecurityNotificationContext

export default function SignInNotification({
	appUrl,
	occurredAt,
	...context
}: SignInNotificationProps) {
	return (
		<SecurityNotificationLayout
			appUrl={appUrl}
			preview={`New sign-in to your ${appInfo.name} account`}
			heading="New sign-in to your account"
		>
			<SecurityDetailRows occurredAt={occurredAt} {...context} />

			<EmailText className="mb-4">If this was you, there’s nothing else you need to do.</EmailText>

			<EmailText>If you don’t recognize this activity, change your password immediately.</EmailText>
		</SecurityNotificationLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
SignInNotification.PreviewProps = {
	...emailPreview,
	ipAddress: '0.0.0.0',
	occurredAt: new Date(),
	country: 'US',
	city: 'San Francisco',
	region: 'CA',
	timezone: 'America/Los_Angeles',
	device: 'Chrome 126 on Windows (Desktop)',
} as SignInNotificationProps

export async function renderSignInNotification(signInNotificationProps: SignInNotificationProps) {
	return renderSecurityNotification(
		<SignInNotification {...signInNotificationProps} />,
		`New sign-in to your ${appInfo.name} account`,
	)
}

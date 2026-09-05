// @refresh reset

import {
	BodyCopy,
	renderSecurityNotification,
	SecurityDetailRows,
	SecurityNotificationLayout,
} from './security-notification.tsx'
import type {SecurityNotificationContext} from './security-notification.tsx'

type SignInNotificationProps = {occurredAt: Date} & SecurityNotificationContext

export default function SignInNotification({occurredAt, ...context}: SignInNotificationProps) {
	return (
		<SecurityNotificationLayout
			preview="New sign-in to your account"
			heading="New sign-in to your account"
		>
			<SecurityDetailRows occurredAt={occurredAt} {...context} />

			<BodyCopy>If this was you, there's nothing else you need to do.</BodyCopy>

			<BodyCopy>If you don't recognize this activity, change your password immediately.</BodyCopy>
		</SecurityNotificationLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
SignInNotification.PreviewProps = {
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
		'New sign-in to your account',
	)
}

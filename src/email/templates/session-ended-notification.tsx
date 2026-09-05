// @refresh reset

import {
	BodyCopy,
	renderSecurityNotification,
	SecurityDetailRows,
	SecurityNotificationLayout,
} from './security-notification.tsx'
import type {SecurityNotificationContext} from './security-notification.tsx'

type SessionEndedNotificationProps = {occurredAt: Date} & SecurityNotificationContext

export default function SessionEndedNotification({
	occurredAt,
	...context
}: SessionEndedNotificationProps) {
	return (
		<SecurityNotificationLayout
			preview="Alert: Session revoked due to security concerns"
			heading="We signed you out"
		>
			<SecurityDetailRows occurredAt={occurredAt} {...context} />

			<BodyCopy>
				We detected that one of your sign-in sessions may have been accessed by someone else, so we
				ended it to protect your account.
			</BodyCopy>

			<BodyCopy>
				If this was you, there's nothing else you need to do. You can sign in again.
			</BodyCopy>

			<BodyCopy>
				If you don't recognize this activity, change your password and "sign out all" immediately.
				Review your browser extensions and recently installed applications, something may be
				stealing your cookies.
			</BodyCopy>
		</SecurityNotificationLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
SessionEndedNotification.PreviewProps = {
	ipAddress: '0.0.0.0',
	occurredAt: new Date(),
	country: 'US',
	city: 'San Francisco',
	region: 'CA',
	timezone: 'America/Los_Angeles',
	device: 'Chrome 126 on Windows (Desktop)',
} as SessionEndedNotificationProps

export async function renderSessionEndedNotification(
	sessionEndedNotificationProps: SessionEndedNotificationProps,
) {
	return renderSecurityNotification(
		<SessionEndedNotification {...sessionEndedNotificationProps} />,
		'Your session was ended for security',
	)
}

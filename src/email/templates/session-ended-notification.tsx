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

type SessionEndedNotificationProps = {
	appUrl: string
	occurredAt: Date
} & SecurityNotificationContext

export default function SessionEndedNotification({
	appUrl,
	occurredAt,
	...context
}: SessionEndedNotificationProps) {
	return (
		<SecurityNotificationLayout
			appUrl={appUrl}
			preview={`We ended a session on your ${appInfo.name} account`}
			heading="We signed you out"
		>
			<SecurityDetailRows occurredAt={occurredAt} {...context} />

			<EmailText className="mb-4">
				We detected that one of your sign-in sessions may have been accessed by someone else, so we
				ended it to protect your account.
			</EmailText>

			<EmailText className="mb-4">
				If this was you, there’s nothing else you need to do. You can sign in again.
			</EmailText>

			<EmailText>
				If you don’t recognize this activity, change your password and “sign out all” immediately.
				Review your browser extensions and recently installed applications; something may be
				stealing your cookies.
			</EmailText>
		</SecurityNotificationLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
SessionEndedNotification.PreviewProps = {
	...emailPreview,
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
		`Your ${appInfo.name} session was ended`,
	)
}

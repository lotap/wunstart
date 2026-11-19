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

type EmailChangeConfirmationProps = {
	appUrl: string
	occurredAt: Date
} & SecurityNotificationContext

export default function EmailChangeConfirmation({
	appUrl,
	occurredAt,
	...context
}: EmailChangeConfirmationProps) {
	return (
		<SecurityNotificationLayout
			appUrl={appUrl}
			preview={`Your ${appInfo.name} email was changed`}
			heading="You’ve changed your email"
		>
			<SecurityDetailRows occurredAt={occurredAt} {...context} />

			<EmailText className="mb-4">If this was you, there’s nothing else you need to do.</EmailText>

			<EmailText>Otherwise, sign in with a passcode to recover your account.</EmailText>
		</SecurityNotificationLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
EmailChangeConfirmation.PreviewProps = {
	...emailPreview,
	ipAddress: '0.0.0.0',
	occurredAt: new Date(),
	country: 'US',
	city: 'San Francisco',
	region: 'CA',
	timezone: 'America/Los_Angeles',
	device: 'Chrome 126 on Windows (Desktop)',
} as EmailChangeConfirmationProps

export async function renderEmailChangeConfirmation(
	emailChangeConfirmationProps: EmailChangeConfirmationProps,
) {
	return renderSecurityNotification(
		<EmailChangeConfirmation {...emailChangeConfirmationProps} />,
		`Your ${appInfo.name} email was changed`,
	)
}

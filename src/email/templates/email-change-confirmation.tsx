// @refresh reset

import {
	BodyCopy,
	renderSecurityNotification,
	SecurityDetailRows,
	SecurityNotificationLayout,
} from './security-notification.tsx'
import type {SecurityNotificationContext} from './security-notification.tsx'

type EmailChangeConfirmationProps = {occurredAt: Date} & SecurityNotificationContext

export default function EmailChangeConfirmation({
	occurredAt,
	...context
}: EmailChangeConfirmationProps) {
	return (
		<SecurityNotificationLayout
			preview="Your email was changed"
			heading="You’ve changed your email"
		>
			<SecurityDetailRows occurredAt={occurredAt} {...context} />

			<BodyCopy>If this was you, there's nothing else you need to do.</BodyCopy>

			<BodyCopy>Otherwise, sign in with a passcode to recover your account.</BodyCopy>
		</SecurityNotificationLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
EmailChangeConfirmation.PreviewProps = {
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
		'Confirmation: Your email was changed',
	)
}

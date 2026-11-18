// @refresh reset

import type {ReactElement, ReactNode} from 'react'
import {render} from 'react-email'

import {EmailDetailRows} from '../components/email-detail-rows.tsx'
import type {EmailDetailContext} from '../components/email-detail-rows.tsx'
import {EmailLayout} from '../components/email-layout.tsx'
import {EmailHeading} from '../components/email-typography.tsx'

/** Visitor context shared by all security notification emails */
export type SecurityNotificationContext = EmailDetailContext

/** Shared shell for security notifications: wordmark, heading, then detail-led copy */
export function SecurityNotificationLayout({
	appUrl,
	preview,
	heading,
	children,
}: {
	appUrl: string
	preview: string
	heading: string
	children: ReactNode
}) {
	return (
		<EmailLayout appUrl={appUrl} preview={preview}>
			<EmailHeading className="mb-6">{heading}</EmailHeading>
			{children}
		</EmailLayout>
	)
}

/** Time / IP / location / device rows shared by all security notifications */
export {EmailDetailRows as SecurityDetailRows}

/** Renders a security email to html + plain text with the given subject */
export async function renderSecurityNotification(component: ReactElement, subject: string) {
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])

	return {subject, html, text}
}

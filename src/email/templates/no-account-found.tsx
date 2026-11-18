// @refresh reset

import {Section, Text, render} from 'react-email'

import {appInfo} from '#/app-info.ts'

import {EmailLayout} from '../components/email-layout.tsx'
import {EmailHeading, EmailSmallText, EmailText} from '../components/email-typography.tsx'
import {emailPreview} from '../preview.ts'

type NoAccountFoundProps = {
	/** Public app URL, used to show the sign-up address as plain text rather than a link */
	appUrl: string
}

export default function NoAccountFound({appUrl}: NoAccountFoundProps) {
	const signUpAddress = `${appUrl.replace(/\/$/, '')}/sign-up`.replace(/^https?:\/\//, '')

	return (
		<EmailLayout
			appUrl={appUrl}
			preview={`Someone tried to sign in to ${appInfo.name} with this address`}
			align="center"
		>
			<EmailHeading className="mb-4">No account found</EmailHeading>
			<EmailText className="mb-6">
				Someone tried to sign in to {appInfo.name} with this email address, but no account exists
				for it.
			</EmailText>
			<Section className="mb-6 rounded-lg border border-border bg-secondary px-4 py-5 text-center">
				<Text className="m-0 text-xs leading-5 font-medium text-muted-foreground">
					Sign-up page
				</Text>
				<Text className="m-0 mt-2 font-mono text-base leading-5 font-semibold text-foreground">
					{signUpAddress}
				</Text>
			</Section>
			<EmailText className="mb-4 text-sm leading-5">
				To create an account, open the address above in your browser and request a code.
			</EmailText>
			<EmailSmallText className="mt-4">
				If you didn’t try to sign in, you can ignore this email. Someone may have mistyped their
				address.
			</EmailSmallText>
		</EmailLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
NoAccountFound.PreviewProps = {
	...emailPreview,
} as NoAccountFoundProps

export async function renderNoAccountFound(appUrl: string) {
	const component = <NoAccountFound appUrl={appUrl} />
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])

	return {subject: `No ${appInfo.name} account found for this address`, html, text}
}

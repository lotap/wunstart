// @refresh reset

import {render} from 'react-email'

import {appInfo} from '#/app-info.ts'

import {EmailCode} from '../components/email-code.tsx'
import {EmailLayout} from '../components/email-layout.tsx'
import {EmailHeading, EmailSmallText, EmailText} from '../components/email-typography.tsx'
import {emailPreview} from '../preview.ts'

type VerifyEmailVariant = 'signup' | 'signin' | 'signup-existing'

type VerifyEmailProps = {
	code: string
	appUrl: string
	variant?: VerifyEmailVariant
	/** Anon-keyed rows verify only in the browser that requested the code */
	anonBound?: boolean
	/** Rendered into the expiry line; the op passes `PASSCODE_EXPIRATION` */
	expiresIn: string
}

const variantCopy = {
	'signup': {
		subject: `Your ${appInfo.name} verification code`,
		preview: `Enter this code to complete your sign-up at ${appInfo.name}`,
		body: `Enter this code to complete your sign-up at ${appInfo.name}:`,
	},
	'signin': {
		subject: `Your ${appInfo.name} sign-in code`,
		preview: `Enter this code to sign in to ${appInfo.name}`,
		body: `Enter this code to sign in to ${appInfo.name}:`,
	},
	'signup-existing': {
		subject: `Your ${appInfo.name} sign-in code`,
		preview: `Someone tried to create a ${appInfo.name} account with this address`,
		body: `Someone tried to create a ${appInfo.name} account with this address. If it was you, use this code to sign in:`,
	},
} satisfies Record<VerifyEmailVariant, {subject: string; preview: string; body: string}>

export default function VerifyEmail({
	code,
	appUrl,
	variant = 'signup',
	anonBound = false,
	expiresIn,
}: VerifyEmailProps) {
	const copy = variantCopy[variant]

	return (
		<EmailLayout appUrl={appUrl} preview={copy.preview} align="center">
			<EmailHeading className="mb-4">Verify your email</EmailHeading>
			<EmailText className="mb-6">{copy.body}</EmailText>
			<EmailCode code={code} />
			{anonBound && (
				<EmailSmallText className="mb-2">
					This code works only in the browser where you requested it. On a different device, request
					a new code there.
				</EmailSmallText>
			)}
			<EmailSmallText>
				This code expires in {expiresIn}. If you didn’t request it, you can ignore this email. Never
				share this code with anyone.
			</EmailSmallText>
		</EmailLayout>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
VerifyEmail.PreviewProps = {
	...emailPreview,
	code: '123456',
	anonBound: true,
	expiresIn: '15 minutes',
} as VerifyEmailProps

export async function renderVerificationEmail({
	code,
	appUrl,
	variant = 'signup',
	anonBound = false,
	expiresIn,
}: VerifyEmailProps) {
	const component = (
		<VerifyEmail
			code={code}
			appUrl={appUrl}
			variant={variant}
			anonBound={anonBound}
			expiresIn={expiresIn}
		/>
	)

	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])

	return {subject: variantCopy[variant].subject, html, text}
}

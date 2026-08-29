// @refresh reset

import {Body, Container, Head, Heading, Html, Preview, Tailwind, Text, render} from 'react-email'

import {emailTailwindConfig} from '../tailwind-config.ts'

type VerifyEmailProps = {
	code: string
}

export default function VerifyEmail({code}: VerifyEmailProps) {
	return (
		<Html>
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Preview>Enter this code to complete your sign-up</Preview>
				<Body className="m-0 font-sans">
					<Container className="mx-auto mt-10 max-w-150 px-5">
						<Heading className="mb-6 text-xl font-semibold">Verify your email</Heading>
						<Text className="mb-4 text-sm leading-relaxed text-muted-foreground">
							Enter this code to complete your sign-up:
						</Text>
						<Container className="mb-4 rounded-[8px] bg-muted p-4 text-center">
							<Text className="m-0 font-mono text-4xl font-bold tracking-[8px]">{code}</Text>
						</Container>
						<Text className="text-xs leading-relaxed text-muted-foreground">
							This code expires in 15 minutes. If you didn't request this, you can ignore this
							email.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
VerifyEmail.PreviewProps = {
	code: '123456',
} as VerifyEmailProps

export async function renderVerificationEmail(code: string) {
	const component = <VerifyEmail code={code} />
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])
	return {subject: 'Verify your email', html, text}
}

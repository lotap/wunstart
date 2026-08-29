// @refresh reset

import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	render,
	Section,
	Tailwind,
	Text,
} from 'react-email'

import {emailTailwindConfig} from '../tailwind-config.ts'

type PasswordChangeConfirmationProps = {
	ipAddress: string
	updatedAt: Date
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeStyle: 'short',
	timeZone: 'America/New_York',
})

export default function PasswordChangeConfirmation({
	ipAddress,
	updatedAt,
}: PasswordChangeConfirmationProps) {
	return (
		<Html>
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Body className="m-0 text-center font-sans">
					<Preview>Your password was changed</Preview>
					<Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-160">
						<Section>
							<Section className="mobile:px-2 px-6 py-4">
								<Section className="mobile:px-6 mobile:py-12 rounded-[8px] px-10 py-20 text-left text-secondary-foreground">
									<Section className="mb-8">
										<Heading as="h1" className="font-28 m-0 text-left font-sans">
											You’ve changed your password
										</Heading>
									</Section>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										<b>Time: </b>
										{dateFormatter.format(updatedAt)} ET
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										<b>IP Address: </b>
										{ipAddress}
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										If this was you, there's nothing else you need to do.
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										Otherwise, sign in with a passcode to recover your account.
									</Text>
								</Section>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
PasswordChangeConfirmation.PreviewProps = {
	ipAddress: '0.0.0.0',
	updatedAt: new Date(),
} as PasswordChangeConfirmationProps

export async function renderPasswordChangeConfirmation(
	passwordChangeConfirmationProps: PasswordChangeConfirmationProps,
) {
	const component = <PasswordChangeConfirmation {...passwordChangeConfirmationProps} />
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])
	return {subject: 'Confirmation: Your password was changed', html, text}
}

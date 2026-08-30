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

import {formatLocation} from '../format-location.ts'
import {emailTailwindConfig} from '../tailwind-config.ts'

type SignInNotificationProps = {
	ipAddress: string
	signedInAt: Date
	country: string
	city: string | null
	region: string | null
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	dateStyle: 'long',
	timeStyle: 'short',
	timeZone: 'America/New_York',
})

export default function SignInNotification({
	ipAddress,
	signedInAt,
	country,
	city,
	region,
}: SignInNotificationProps) {
	const location = formatLocation({city, region, country})

	return (
		<Html>
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Body className="m-0 text-center font-sans">
					<Preview>New sign-in to your account</Preview>
					<Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-160">
						<Section>
							<Section className="mobile:px-2 px-6 py-4">
								<Section className="mobile:px-6 mobile:py-12 rounded-[8px] px-10 py-20 text-left text-secondary-foreground">
									<Section className="mb-8">
										<Heading as="h1" className="font-28 m-0 text-left font-sans">
											New sign-in to your account
										</Heading>
									</Section>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										<b>Time: </b>
										{dateFormatter.format(signedInAt)} ET
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										<b>IP Address: </b>
										{ipAddress}
									</Text>

									{location && (
										<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
											<b>Location: </b>
											{location}
										</Text>
									)}

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										If this was you, there's nothing else you need to do.
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										If you don't recognize this activity, change your password immediately.
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
SignInNotification.PreviewProps = {
	ipAddress: '0.0.0.0',
	signedInAt: new Date(),
	country: 'US',
	city: 'San Francisco',
	region: 'CA',
} as SignInNotificationProps

export async function renderSignInNotification(signInNotificationProps: SignInNotificationProps) {
	const component = <SignInNotification {...signInNotificationProps} />
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])
	return {subject: 'New sign-in to your account', html, text}
}

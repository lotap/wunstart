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
import {formatEmailTime} from '../format-time.ts'
import {emailTailwindConfig} from '../tailwind-config.ts'

type SessionEndedNotificationProps = {
	ipAddress: string
	revokedAt: Date
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	device: string | null
}

export default function SessionEndedNotification({
	ipAddress,
	revokedAt,
	country,
	city,
	region,
	timezone,
	device,
}: SessionEndedNotificationProps) {
	const location = formatLocation({city, region, country})

	return (
		<Html>
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Body className="m-0 text-center font-sans">
					<Preview>Alert: Session revoked due to security concerns</Preview>
					<Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-160">
						<Section>
							<Section className="mobile:px-2 px-6 py-4">
								<Section className="mobile:px-6 mobile:py-12 rounded-[8px] px-10 py-20 text-left text-secondary-foreground">
									<Section className="mb-8">
										<Heading as="h1" className="font-28 m-0 text-left font-sans">
											We signed you out
										</Heading>
									</Section>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										<b>Time: </b>
										{formatEmailTime(revokedAt, timezone)}
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

									{device && (
										<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
											<b>Device: </b>
											{device}
										</Text>
									)}

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										We detected that one of your sign-in sessions may have been accessed by someone
										else, so we ended it to protect your account.
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										If this was you, there's nothing else you need to do. You can sign in again.
									</Text>

									<Text className="font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0">
										If you don't recognize this activity, change your password and "sign out all"
										immediately. Review your browser extensions and recently installed applications,
										something may be stealing your cookies.
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
SessionEndedNotification.PreviewProps = {
	ipAddress: '0.0.0.0',
	revokedAt: new Date(),
	country: 'US',
	city: 'San Francisco',
	region: 'CA',
	timezone: 'America/Los_Angeles',
	device: 'Chrome 126 on Windows (Desktop)',
} as SessionEndedNotificationProps

export async function renderSessionEndedNotification(
	sessionEndedNotificationProps: SessionEndedNotificationProps,
) {
	const component = <SessionEndedNotification {...sessionEndedNotificationProps} />
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])
	return {subject: 'Your session was ended for security', html, text}
}

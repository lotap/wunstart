// @refresh reset

import type {ReactElement, ReactNode} from 'react'
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

/** Visitor context shared by all security notification emails */
export type SecurityNotificationContext = {
	ipAddress: string
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	device: string | null
}

/** Shared shell for security notification emails: centered card with a heading */
export function SecurityNotificationLayout({
	preview,
	heading,
	children,
}: {
	preview: string
	heading: string
	children: ReactNode
}) {
	return (
		<Html>
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Body className="m-0 text-center font-sans">
					<Preview>{preview}</Preview>
					<Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-160">
						<Section>
							<Section className="mobile:px-2 px-6 py-4">
								<Section className="mobile:px-6 mobile:py-12 rounded-[8px] px-10 py-20 text-left text-secondary-foreground">
									<Section className="mb-8">
										<Heading as="h1" className="font-28 m-0 text-left font-sans">
											{heading}
										</Heading>
									</Section>

									{children}
								</Section>
							</Section>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}

const detailRowClassName = 'font-16 mt-0 mb-6 max-w-105 text-left font-sans last:mb-0'

/** Single labeled detail line (Time, IP Address, …) */
export function DetailRow({label, value}: {label: string; value: string}) {
	return (
		<Text className={detailRowClassName}>
			<b>{label}: </b>
			{value}
		</Text>
	)
}

/** Body copy block for security notification emails */
export function BodyCopy({children}: {children: ReactNode}) {
	return <Text className={detailRowClassName}>{children}</Text>
}

/** Time / IP / Location / Device rows shared by all security notification emails */
export function SecurityDetailRows({
	occurredAt,
	ipAddress,
	country,
	city,
	region,
	timezone,
	device,
}: {occurredAt: Date} & SecurityNotificationContext) {
	const location = formatLocation({city, region, country})

	return (
		<>
			<DetailRow label="Time" value={formatEmailTime(occurredAt, timezone)} />
			<DetailRow label="IP Address" value={ipAddress} />
			{location && <DetailRow label="Location" value={location} />}
			{device && <DetailRow label="Device" value={device} />}
		</>
	)
}

/** Renders a security email to html + plain text with the given subject */
export async function renderSecurityNotification(component: ReactElement, subject: string) {
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])
	return {subject, html, text}
}

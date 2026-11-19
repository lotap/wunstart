import type {ReactNode} from 'react'
import {Body, Container, Head, Html, Img, Preview, Section, Tailwind, Text} from 'react-email'

import {appInfo} from '#/app-info.ts'
import {cn} from '#/lib/utils.ts'

import {emailTailwindConfig} from '../tailwind-config.ts'

type EmailLayoutProps = {
	/** Public app URL; also resolves the wordmark and the address shown in the footer */
	appUrl: string
	preview: string
	/** Auth and account emails center their copy; security notifications stay left-aligned */
	align?: 'left' | 'center'
	children: ReactNode
}

/** Public path of the email wordmark; update here when replacing the brand asset */
const wordmarkPath = '/email/wunstart-wordmark.png'

const baseUrl = (appUrl: string) => appUrl.replace(/\/$/, '')

const displayUrl = (appUrl: string) => appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

/** Shared chrome for every email: page background, card, wordmark, and footer. */
export function EmailLayout({appUrl, preview, align = 'left', children}: EmailLayoutProps) {
	return (
		<Html lang="en">
			<Tailwind config={emailTailwindConfig}>
				<Head>
					{/*
					 * Light-only on purpose. Client dark-mode support is inconsistent,
					 * and swapping just the wordmark would put a light logo on a light
					 * card whenever only the OS prefers dark.
					 */}
					<meta name="color-scheme" content="light" />
					<meta name="supported-color-schemes" content="light" />
				</Head>
				<Preview>{preview}</Preview>
				<Body className="m-0 bg-secondary font-sans">
					<Container className="mx-auto w-full max-w-160 px-4 py-8">
						<Section className="rounded-lg border border-border bg-card">
							<Section className="px-6 pt-8 text-center">
								<Img
									src={`${baseUrl(appUrl)}${wordmarkPath}`}
									width={162}
									height={27}
									alt={appInfo.name}
									className="mx-auto block"
								/>
							</Section>
							<Section className={cn('px-6 py-8', align === 'center' && 'text-center')}>
								{children}
							</Section>
							<EmailFooter appUrl={appUrl} />
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}

function EmailFooter({appUrl}: {appUrl: string}) {
	return (
		<Section className="border-t border-border px-6 py-6 text-center">
			<Text className="m-0 text-xs leading-5 text-muted-foreground">
				<span className="font-semibold text-foreground">{appInfo.name}</span>
				{' · '}
				{displayUrl(appUrl)}
			</Text>
			<Text className="m-0 mt-2 text-xs leading-5 text-muted-foreground">
				{appInfo.description}
			</Text>
			<Text className="m-0 mt-2 text-xs leading-5 text-muted-foreground">
				This is an automated security message. We’ll never ask you to reply with a code or password.
			</Text>
		</Section>
	)
}

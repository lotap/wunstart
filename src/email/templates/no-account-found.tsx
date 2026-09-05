// @refresh reset

import {Body, Container, Head, Heading, Html, Preview, Tailwind, Text, render} from 'react-email'

import {emailTailwindConfig} from '../tailwind-config.ts'

export default function NoAccountFound() {
	return (
		<Html>
			<Tailwind config={emailTailwindConfig}>
				<Head />
				<Preview>Failed sign in attempt for this address</Preview>
				<Body className="m-0 font-sans">
					<Container className="mx-auto mt-10 max-w-150 px-5">
						<Heading className="mb-6 text-xl font-semibold">No account found</Heading>
						<Text className="mb-4 text-sm leading-relaxed text-muted-foreground">
							Someone tried to sign in with this address, but no account exists for it. To create
							one, go to the sign-up page and request a code.
						</Text>
						<Text className="text-xs leading-relaxed text-muted-foreground">
							If you didn&apos;t request this, you can ignore this email.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	)
}

// SAFETY: PreviewProps only feeds react-email's preview pane; the values are
// representative placeholders for the required props.
NoAccountFound.PreviewProps = {} as Record<string, never>

export async function renderNoAccountFound() {
	const component = <NoAccountFound />
	const [html, text] = await Promise.all([render(component), render(component, {plainText: true})])
	return {subject: 'No account found for this address', html, text}
}

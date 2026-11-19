import {Section, Text} from 'react-email'

/** The one-time passcode panel shared by every verification email variant. */
export function EmailCode({code}: {code: string}) {
	return (
		<Section className="mb-6 rounded-lg border border-border bg-secondary px-4 py-5 text-center">
			<Text className="m-0 pl-[0.2em] font-mono text-4xl leading-none font-semibold tracking-[0.2em] text-foreground">
				{code}
			</Text>
		</Section>
	)
}

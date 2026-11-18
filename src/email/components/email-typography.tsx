import type {ReactNode} from 'react'
import {Heading, Text} from 'react-email'

import {cn} from '#/lib/utils.ts'

/** Page title for every transactional email. One h1 per message. */
export function EmailHeading({children, className}: {children: ReactNode; className?: string}) {
	return (
		<Heading
			as="h1"
			className={cn('m-0 font-heading text-3xl leading-9 font-semibold text-foreground', className)}
		>
			{children}
		</Heading>
	)
}

/** Primary body copy: 16px with a 24px line height. */
export function EmailText({children, className}: {children: ReactNode; className?: string}) {
	return (
		<Text className={cn('m-0 text-base leading-6 text-secondary-foreground', className)}>
			{children}
		</Text>
	)
}

/** Fine print: 12px with a 20px line height. */
export function EmailSmallText({children, className}: {children: ReactNode; className?: string}) {
	return (
		<Text className={cn('m-0 text-xs leading-5 text-muted-foreground', className)}>{children}</Text>
	)
}

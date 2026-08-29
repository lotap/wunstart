import {useQuery} from '@tanstack/react-query'
import {cva} from 'class-variance-authority'
import {DateTime, Duration} from 'effect'
import {RotateCw} from 'lucide-react'
import {useEffect, useMemo, useState} from 'react'
import {toast} from 'sonner'

import {Button} from '#/components/ui/button.tsx'

import type {EmailRequestVerificationQueryOptions} from './_utils.ts'

const resetPasscodeIconVariants = cva('', {
	variants: {
		isPending: {
			true: 'animate-spin',
		},
	},
})

const calcEnabledAt = (expiresAt: DateTime.Utc) => expiresAt.pipe(DateTime.subtract({minutes: 14}))

const calcTimeUntilEnabled = (enabledAt: DateTime.Utc) =>
	DateTime.distance(DateTime.nowUnsafe(), enabledAt)

export function ResetEmailVerificationButton({
	email,
	queryOptions,
	mutateAsync,
	mutationIsPending,
	onRequestNewCode,
}: {
	email: string
	queryOptions: EmailRequestVerificationQueryOptions
	mutateAsync: () => Promise<{expiresAt: Date}>
	mutationIsPending: boolean
	onRequestNewCode?: () => void
}) {
	const {data: emailRequestVerificationData} = useQuery(queryOptions)

	const expiresAtUtc = emailRequestVerificationData?.expiresAt

	const expiresAt = useMemo(() => expiresAtUtc ?? DateTime.nowUnsafe(), [expiresAtUtc])

	const [timeUntilEnabled, setTimeUntilEnabled] = useState(() =>
		calcTimeUntilEnabled(calcEnabledAt(expiresAt)),
	)

	const isDisabled = Duration.isPositive(timeUntilEnabled)

	useEffect(() => {
		const enabledAt = calcEnabledAt(expiresAt)

		let intervalId: ReturnType<typeof setInterval> | undefined

		const handleTimer = () => {
			if (DateTime.isPastUnsafe(enabledAt)) {
				setTimeUntilEnabled(Duration.zero)
				clearInterval(intervalId)
			} else {
				setTimeUntilEnabled(calcTimeUntilEnabled(enabledAt))
			}
		}

		handleTimer()
		intervalId = setInterval(handleTimer, 1000)

		return () => clearInterval(intervalId)
	}, [expiresAt])

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className="w-fit! self-center text-muted-foreground"
			disabled={isDisabled}
			onClick={async () => {
				onRequestNewCode?.()
				try {
					await mutateAsync()
					toast.success(`New code sent to ${email}`, {
						duration: 2500,
						position: 'bottom-center',
					})
				} catch (error) {
					toast.error(
						error instanceof Error
							? error.message
							: 'Something went wrong on our end. Please try again later.',
						{
							position: 'bottom-center',
						},
					)
				}
			}}
		>
			<RotateCw
				data-icon="inline-start"
				className={resetPasscodeIconVariants({isPending: mutationIsPending})}
			/>
			Send a new code
			{isDisabled && (
				<span className="font-mono font-bold">
					{' '}
					{Math.ceil(Duration.toSeconds(timeUntilEnabled))}
				</span>
			)}
		</Button>
	)
}

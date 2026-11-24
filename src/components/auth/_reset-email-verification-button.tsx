import {useQuery} from '@tanstack/react-query'
import {cva} from 'class-variance-authority'
import {DateTime, Duration} from 'effect'
import {RotateCw} from 'lucide-react'
import {useEffect, useState} from 'react'

import {Button} from '#/components/ui/button.tsx'
import {toast} from '#/components/ui/toast.tsx'

import {useDeadSessionRecovery} from './_hooks.ts'
import type {PasscodeRequestQueryOptions, PasscodeRequestResult} from './_utils.ts'

const resetPasscodeIconVariants = cva('', {
	variants: {
		isPending: {
			true: 'animate-spin',
		},
	},
})

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
	queryOptions: PasscodeRequestQueryOptions
	mutateAsync: () => Promise<PasscodeRequestResult>
	mutationIsPending: boolean
	onRequestNewCode?: () => void
}) {
	const {data: passcodeRequestData} = useQuery(queryOptions)

	const recoverDeadSession = useDeadSessionRecovery()

	/** The server owns the resend gate; this only counts down to the moment it returns */
	const enabledAt = passcodeRequestData?.resendAvailableAt ?? DateTime.nowUnsafe()

	const [timeUntilEnabled, setTimeUntilEnabled] = useState(() => calcTimeUntilEnabled(enabledAt))

	const isDisabled = Duration.isPositive(timeUntilEnabled)

	useEffect(() => {
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
	}, [enabledAt])

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
					toast.add({title: `New code sent to ${email}`, type: 'success', timeout: 2500})
				} catch (error) {
					recoverDeadSession(error)

					toast.add({
						type: 'error',
						title:
							error instanceof Error
								? error.message
								: 'Something went wrong on our end. Please try again later.',
					})
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

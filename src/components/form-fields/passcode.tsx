import type {FieldWithValue} from '@tanstack/react-form'
import {REGEXP_ONLY_DIGITS} from 'input-otp'

import {Field, FieldError, FieldLabel} from '#/components/ui/field.tsx'
import {InputOTP, InputOTPGroup, InputOTPSlot} from '#/components/ui/input-otp.tsx'

export function PasscodeField({
	field,
	onComplete,
}: {
	field: FieldWithValue<string>
	onComplete?: (...args: any[]) => void
}) {
	const isInvalid = field.meta.isTouched && !field.meta.isValid

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name} className="sr-only">
				Passcode
			</FieldLabel>

			<InputOTP
				maxLength={6}
				pattern={REGEXP_ONLY_DIGITS}
				onChange={field.handleChange}
				onComplete={onComplete}
				aria-invalid={isInvalid}
				placeholder="000000"
				containerClassName="justify-center"
			>
				<InputOTPGroup>
					<InputOTPSlot index={0} className="size-14 text-4xl" />
					<InputOTPSlot index={1} className="size-14 text-4xl" />
					<InputOTPSlot index={2} className="size-14 text-4xl" />
					<InputOTPSlot index={3} className="size-14 text-4xl" />
					<InputOTPSlot index={4} className="size-14 text-4xl" />
					<InputOTPSlot index={5} className="size-14 text-4xl" />
				</InputOTPGroup>
			</InputOTP>

			{isInvalid && (
				<FieldError aria-describedby={field.name} errors={field.errors} className="text-center" />
			)}
		</Field>
	)
}

import type {FieldWithValue} from '@tanstack/react-form'
import {REGEXP_ONLY_DIGITS} from 'input-otp'

import {Field, FieldLabel} from '#/components/ui/field.tsx'
import {InputOTP, InputOTPGroup, InputOTPSlot} from '#/components/ui/input-otp.tsx'

import {FormError} from './form-error.tsx'

export function PasscodeField({
	field,
	formId,
	onComplete,
}: {
	field: FieldWithValue<string>
	/** Stable form slug; prefixes the DOM id, not the submitted field name */
	formId: string
	onComplete?: (...args: any[]) => void
}) {
	const isInvalid = field.meta.isTouched && !field.meta.isValid
	const id = `${formId}-${field.name}`
	const errorId = `${id}-error`

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id} className="sr-only">
				Passcode
			</FieldLabel>

			<InputOTP
				id={id}
				name={field.name}
				maxLength={6}
				pattern={REGEXP_ONLY_DIGITS}
				onChange={field.handleChange}
				onComplete={onComplete}
				aria-invalid={isInvalid}
				aria-describedby={isInvalid ? errorId : undefined}
				required
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

			{isInvalid && <FormError id={errorId} errors={field.errors} align="center" />}
		</Field>
	)
}

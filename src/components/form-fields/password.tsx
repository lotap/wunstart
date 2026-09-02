import type {FieldWithValue} from '@tanstack/react-form'
import {cva} from 'class-variance-authority'
import {Eye, EyeOff} from 'lucide-react'
import {lazy, Suspense, useState} from 'react'

import {Field, FieldError, FieldLabel} from '#/components/ui/field.tsx'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '#/components/ui/input-group.tsx'

const PasswordStrengthMeter = lazy(() => import('./password-strength-meter.tsx'))

const errorTextVariants = cva('text-center', {
	variants: {
		isDisabled: {
			true: 'opacity-50',
		},
	},
})

export function PasswordField({
	field,
	isDisabled = false,
	showStrength = false,
	strengthUserInputs,
}: {
	field: FieldWithValue<string>
	isDisabled?: boolean
	showStrength?: boolean
	strengthUserInputs?: Array<string>
}) {
	const [showPassword, setShowPassword] = useState(false)

	const isInvalid = field.meta.isTouched && !field.meta.isValid

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={field.name} className="sr-only">
				Password
			</FieldLabel>

			<InputGroup data-disabled={isDisabled}>
				<InputGroupInput
					id={field.name}
					name={field.name}
					value={field.value}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					disabled={isDisabled}
					aria-invalid={isInvalid}
					aria-describedby={isInvalid ? `${field.name}-error` : undefined}
					placeholder="Password"
					type={showPassword ? 'text' : 'password'}
				/>
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						variant="secondary"
						size="icon-xs"
						aria-label={showPassword ? 'Hide password' : 'Show Password'}
						title={showPassword ? 'Hide password' : 'Show Password'}
						onClick={() => setShowPassword(!showPassword)}
						disabled={isDisabled}
					>
						{showPassword ? <EyeOff /> : <Eye />}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>

			{showStrength && (
				<Suspense fallback={null}>
					<PasswordStrengthMeter value={field.value} userInputs={strengthUserInputs} />
				</Suspense>
			)}

			{isInvalid && (
				<FieldError
					id={`${field.name}-error`}
					errors={field.errors}
					className={errorTextVariants({isDisabled})}
				/>
			)}
		</Field>
	)
}

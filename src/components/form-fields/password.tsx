import type {FieldWithValue} from '@tanstack/react-form'
import {Eye, EyeOff} from 'lucide-react'
import {useState} from 'react'

import {Field, FieldLabel} from '#/components/ui/field.tsx'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from '#/components/ui/input-group.tsx'
import type {PasswordStrength} from '#/isomorphic/password-strength.ts'

import {FormError} from './form-error.tsx'
import PasswordStrengthMeter from './password-strength-meter.tsx'

export function PasswordField({
	field,
	formId,
	isDisabled = false,
	strength,
	autoComplete = 'current-password',
}: {
	field: FieldWithValue<string>
	/** Stable form slug; prefixes the DOM id, not the submitted field name */
	formId: string
	isDisabled?: boolean
	/** Latest settled score; pass to render the meter, omit to hide it */
	strength?: PasswordStrength | null
	autoComplete?: 'current-password' | 'new-password'
}) {
	const [showPassword, setShowPassword] = useState(false)

	const isInvalid = field.meta.isTouched && !field.meta.isValid
	const id = `${formId}-${field.name}`
	const errorId = `${id}-error`

	return (
		<Field data-invalid={isInvalid}>
			<FieldLabel htmlFor={id} className="sr-only">
				Password
			</FieldLabel>

			<InputGroup data-disabled={isDisabled}>
				<InputGroupInput
					id={id}
					name={field.name}
					value={field.value}
					onBlur={field.handleBlur}
					onChange={(e) => field.handleChange(e.target.value)}
					disabled={isDisabled}
					aria-invalid={isInvalid}
					aria-describedby={isInvalid ? errorId : undefined}
					autoComplete={autoComplete}
					required
					placeholder="Password"
					minLength={8}
					maxLength={72}
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

			{strength !== undefined && <PasswordStrengthMeter strength={strength} />}

			{isInvalid && <FormError id={errorId} errors={field.errors} isMuted={isDisabled} />}
		</Field>
	)
}

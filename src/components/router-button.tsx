import {createLink} from '@tanstack/react-router'
import {forwardRef} from 'react'

import {Button, type ButtonProps} from '#/components/ui/button.tsx'

export const RouterButton = createLink(
	forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
		return <Button ref={ref} {...props} />
	}),
)

import {createLink} from '@tanstack/react-router'
import type {Ref} from 'react'

import {Button, type ButtonProps} from '#/components/ui/button.tsx'

export const RouterButton = createLink(
	({ref, ...props}: ButtonProps & {ref?: Ref<HTMLButtonElement>}) => {
		return <Button ref={ref} {...props} />
	},
)

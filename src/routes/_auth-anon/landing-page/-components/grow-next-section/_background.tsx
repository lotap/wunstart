import {cn} from 'cn'

import {ShaderBackdrop} from '../shader-backdrop.tsx'

import styles from './_background.module.css'

/** Sticky GrainGradient background for the word section. */
export function GrowNextBackground({
	insetVh,
	noise,
	intensity,
	softness,
}: {
	insetVh: number
	noise?: number
	intensity?: number
	softness?: number
}) {
	return (
		<ShaderBackdrop
			className={cn(styles['mask'], 'inset-x-0')}
			style={{top: `-${insetVh}svh`, bottom: `-${insetVh}svh`}}
			noise={noise}
			intensity={intensity}
			softness={softness}
		/>
	)
}

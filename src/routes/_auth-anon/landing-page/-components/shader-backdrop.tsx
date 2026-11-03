import {GrainGradient} from '@paper-design/shaders-react'
import {cn} from 'cn'
import {type CSSProperties, type ReactNode, useEffect, useRef, useState} from 'react'

import {useTheme} from '#/contexts/theme.tsx'
import {useReducedMotion} from '#/hooks/use-reduced-motion.ts'

const DEFAULT_MAX_PIXEL_COUNT = 1920 * 1080 * 2
const DEFAULT_SPEED = 0.35

/** Stable array identities keep the shader from reinitializing on every render. */
const LIGHT_COLORS = ['#0a0a0a']
const DARK_COLORS = ['#ffffff']
const LIGHT_BACK = '#ffffff'
const DARK_BACK = '#0a0a0a'

type ShaderBackdropProps = {
	className?: string
	style?: CSSProperties
	speed?: number
	noise?: number
	intensity?: number
	softness?: number
}

type LazyShaderBackdropProps = ShaderBackdropProps & {
	rootMargin?: string
}

/** Monochrome, theme-inverted GrainGradient canvas. */
function ShaderCanvas({
	speed = DEFAULT_SPEED,
	noise = 1,
	intensity = 0.75,
	softness = 0.3,
}: Omit<ShaderBackdropProps, 'className' | 'style'>) {
	const {resolved} = useTheme()
	const reduceMotion = useReducedMotion()
	const dark = resolved === 'dark'

	return (
		<GrainGradient
			width="100%"
			height="100%"
			colors={dark ? DARK_COLORS : LIGHT_COLORS}
			colorBack={dark ? DARK_BACK : LIGHT_BACK}
			softness={softness}
			intensity={intensity}
			noise={noise}
			// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names
			shape="ripple"
			speed={reduceMotion ? 0 : speed}
			rotation={180}
			scale={1}
			maxPixelCount={DEFAULT_MAX_PIXEL_COUNT}
		/>
	)
}

function ShaderFrame({
	className,
	style,
	children,
}: {
	className?: string
	style?: CSSProperties
	children: ReactNode
}) {
	return (
		<div aria-hidden="true" className={cn('pointer-events-none absolute', className)} style={style}>
			{children}
		</div>
	)
}

/** Eager shader backdrop. Use when the section is visible on load. */
export function ShaderBackdrop({
	className,
	style,
	speed,
	noise,
	intensity,
	softness,
}: ShaderBackdropProps) {
	return (
		<ShaderFrame className={className} style={style}>
			<ShaderCanvas speed={speed} noise={noise} intensity={intensity} softness={softness} />
		</ShaderFrame>
	)
}

/**
 * Shader backdrop that waits until its frame is near the viewport before
 * creating the WebGL context. The shader library pauses the render loop once
 * the frame scrolls away.
 */
export function LazyShaderBackdrop({
	className,
	style,
	speed,
	noise,
	intensity,
	softness,
	rootMargin = '50% 0px',
}: LazyShaderBackdropProps) {
	const frameRef = useRef<HTMLDivElement>(null)
	const [mounted, setMounted] = useState(false)

	useEffect(() => {
		if (mounted) return

		const frame = frameRef.current

		if (!frame) return

		if (typeof IntersectionObserver === 'undefined') {
			const mountFrame = requestAnimationFrame(() => setMounted(true))

			return () => cancelAnimationFrame(mountFrame)
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return

				setMounted(true)
				observer.disconnect()
			},
			{rootMargin},
		)

		observer.observe(frame)

		return () => observer.disconnect()
	}, [mounted, rootMargin])

	return (
		<div
			ref={frameRef}
			aria-hidden="true"
			className={cn('pointer-events-none absolute', className)}
			style={style}
		>
			{mounted ? (
				<ShaderCanvas speed={speed} noise={noise} intensity={intensity} softness={softness} />
			) : null}
		</div>
	)
}

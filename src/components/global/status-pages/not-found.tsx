import {useLocation} from '@tanstack/react-router'
import {ArrowRight} from 'lucide-react'
import {useEffect, useRef} from 'react'

import {RouterButton} from '../router-button.tsx'
import {StatusPageFrame} from './_status-page-frame.tsx'

const maxPathLength = 96

const controlAndBidiCharacters =
	// oxlint-disable-next-line eslint/no-control-regex -- Stripping control and bidi characters is the point.
	/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g

/** Turn the requested pathname into safe, readable text for the heading. */
function readablePath(pathname: string): string {
	if (pathname === '' || pathname === '/') return ''

	let decoded = pathname

	try {
		decoded = decodeURI(pathname)
	} catch {
		// Keep the raw path when the percent-encoding is malformed.
	}

	const cleaned = decoded.replace(controlAndBidiCharacters, '')

	if (cleaned === '' || cleaned === '/') return ''

	if (cleaned.length <= maxPathLength) return cleaned

	return `${cleaned.slice(0, maxPathLength)}…`
}

export function NotFound() {
	const pathname = useLocation({select: (location) => location.pathname})
	const path = readablePath(pathname)
	const headingRef = useRef<HTMLHeadingElement>(null)

	useEffect(() => {
		headingRef.current?.focus()
	}, [])

	return (
		<StatusPageFrame status="404">
			<h1
				ref={headingRef}
				tabIndex={-1}
				className="max-w-4xl text-4xl font-bold tracking-tight text-pretty outline-none sm:text-5xl lg:text-6xl"
			>
				{path === '' ? (
					'This page isn’t here.'
				) : (
					<>
						There is no page at{' '}
						<span
							dir="ltr"
							className="inline-block max-w-full align-baseline font-mono font-normal tracking-normal break-all"
						>
							{path}
						</span>
					</>
				)}
			</h1>

			<p className="mt-6 max-w-md text-muted-foreground">
				The link may be old, or the address was typed wrong.
			</p>

			<div className="mt-10">
				<RouterButton to="/" size="lg" className="group/cta h-10 rounded-full px-5">
					Take me home
					<ArrowRight
						aria-hidden="true"
						className="size-4 transition-transform delay-100 duration-200 ease-out group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
					/>
				</RouterButton>
			</div>
		</StatusPageFrame>
	)
}

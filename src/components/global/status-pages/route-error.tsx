import {Link, useRouter} from '@tanstack/react-router'
import type {ErrorComponentProps} from '@tanstack/react-router'
import {ArrowRight} from 'lucide-react'
import {useEffect, useRef} from 'react'

import {Button} from '#/components/ui/button.tsx'

import {StatusPageFrame} from './_status-page-frame.tsx'

export function RouteError({error, reset}: ErrorComponentProps) {
	const router = useRouter()
	const headingRef = useRef<HTMLHeadingElement>(null)

	useEffect(() => {
		headingRef.current?.focus()
	}, [])

	const retry = () => {
		void router.invalidate()
		reset()
	}

	return (
		<StatusPageFrame status="500">
			<h1
				ref={headingRef}
				tabIndex={-1}
				className="max-w-3xl font-heading text-4xl font-bold tracking-tight text-pretty outline-none sm:text-5xl lg:text-6xl dark:font-semibold"
			>
				This page didn’t load.
			</h1>

			<p className="mt-6 max-w-md text-muted-foreground">
				Try again. If it keeps happening, come back later.
			</p>

			<div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
				<Button size="lg" className="h-10 rounded-full px-5" onClick={retry}>
					Try again
				</Button>

				<Link
					to="/"
					className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
				>
					Take me home
					<ArrowRight aria-hidden="true" className="size-3.5" />
				</Link>
			</div>

			{import.meta.env.DEV && (
				<pre className="mt-10 max-w-2xl overflow-auto rounded-lg border border-border bg-muted p-4 text-sm wrap-break-word whitespace-pre-wrap">
					{error instanceof Error ? error.message : 'Unknown error'}
				</pre>
			)}
		</StatusPageFrame>
	)
}

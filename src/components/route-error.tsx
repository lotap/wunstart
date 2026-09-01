import {useRouter} from '@tanstack/react-router'
import type {ErrorComponentProps} from '@tanstack/react-router'

import {Button} from './ui/button.tsx'

export function RouteError({error, reset}: ErrorComponentProps) {
	const router = useRouter()

	return (
		<section className="container mx-auto p-4 pt-16">
			<h1 className="text-2xl font-bold">Something broke</h1>
			<p className="mt-2 text-muted-foreground">
				Try again. If it keeps happening, come back later.
			</p>
			<Button
				className="mt-6"
				onClick={() => {
					void router.invalidate()
					reset()
				}}
			>
				Try again
			</Button>
			{import.meta.env.DEV && (
				<pre className="mt-6 overflow-auto rounded-md bg-muted p-4 text-sm">{error.message}</pre>
			)}
		</section>
	)
}

import type {ReactNode} from 'react'

/** Shared full-viewport frame for status pages. */
export function StatusPageFrame({status, children}: {status: '404' | '500'; children: ReactNode}) {
	return (
		<section className="relative isolate flex min-h-svh flex-col justify-center pb-16 sm:pb-24">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 bottom-8 z-0 select-none sm:bottom-20"
			>
				<div className="mx-auto max-w-5xl px-6">
					<span className="block text-right font-mono text-[clamp(10rem,26vw,24rem)] leading-none font-bold tracking-tighter text-foreground/10">
						{status}
					</span>
				</div>
			</div>

			<div className="relative z-10 mx-auto w-full max-w-5xl px-6 py-16 sm:py-20">{children}</div>
		</section>
	)
}

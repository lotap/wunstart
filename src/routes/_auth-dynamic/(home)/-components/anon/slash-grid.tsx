import {cn} from 'cn'

export function SlashGrid({
	className,
	contentLength = 60,
}: {
	className?: string
	contentLength?: number
}) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				'grid w-full grid-cols-60 text-center font-mono text-base leading-tight text-muted-foreground/35 select-none *:transition-transform *:hover:rotate-90',
				className,
			)}
		>
			{Array.from({length: contentLength}).map((_, i) => (
				<div
					// oxlint-disable-next-line react/no-array-index-key
					key={i}
				>
					/
				</div>
			))}
		</div>
	)
}

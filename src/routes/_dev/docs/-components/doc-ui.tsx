import {mergeProps} from '@base-ui/react/merge-props'
import {useRender} from '@base-ui/react/use-render'
import {cn} from 'cn'

/** Small uppercase label used above code, tables, and sidebar groups. */
export function MicroLabel({className, children, ...props}: React.ComponentProps<'p'>) {
	return (
		<p
			className={cn(
				'font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase',
				className,
			)}
			{...props}
		>
			{children}
		</p>
	)
}

/** Table header with the same treatment as a {@link MicroLabel}. */
export function PanelTableHeader({className, children, ...props}: React.ComponentProps<'th'>) {
	return (
		<th
			className={cn(
				'font-mono text-[0.65rem] tracking-[0.16em] text-muted-foreground uppercase',
				className,
			)}
			{...props}
		>
			{children}
		</th>
	)
}

/** Inline link for docs copy. Pass `render` for a router link. */
export function DocLink({className, render, ...props}: useRender.ComponentProps<'a'>) {
	return useRender({
		defaultTagName: 'a',
		props: mergeProps<'a'>(
			{
				className: cn(
					'text-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
					className,
				),
			},
			props,
		),
		render,
	})
}

/** Button that looks like a {@link DocLink}. */
export function DocLinkButton({className, children, ...props}: React.ComponentProps<'button'>) {
	return (
		<button
			type="button"
			className={cn(
				'text-foreground underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
				'inline cursor-pointer',
				className,
			)}
			{...props}
		>
			{children}
		</button>
	)
}

/** Bulleted prose list used in docs panels. */
export function DocBulletList({
	children,
	className,
}: {
	children: React.ReactNode
	className?: string
}) {
	return (
		<ul
			className={cn(
				'flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-muted-foreground/50',
				className,
			)}
		>
			{children}
		</ul>
	)
}

/** mono font inline code box */
export function InlineCode({children}: {children: React.ReactNode}) {
	return (
		<code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs text-foreground">
			{children}
		</code>
	)
}

/** Heading for the content of a side panel. */
export function PanelHeader({title, description}: {title: string; description: string}) {
	return (
		<header className="flex flex-col gap-2">
			<h4 className="text-3xl">{title}</h4>
			<p className="max-w-2xl text-muted-foreground">{description}</p>
		</header>
	)
}

/** Paragraph style for docs sections. */
export function Prose({children}: {children: React.ReactNode}) {
	return <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{children}</p>
}

/** Titled block inside a side panel. Callers compose the content as children. */
export function PanelSection({
	id,
	title,
	className,
	children,
}: {
	id: string
	title: string
	className?: string
	children?: React.ReactNode
}) {
	return (
		<section aria-labelledby={id} className={cn('mt-8', className)}>
			<h5 id={id} className="text-lg font-medium">
				{title}
			</h5>
			{children && <div className="mt-4 flex flex-col gap-3">{children}</div>}
		</section>
	)
}

/** Bordered list used for reference rows. */
export function PanelList({children, className}: {children: React.ReactNode; className?: string}) {
	return (
		<ul className={cn('overflow-hidden rounded-xl border bg-muted/20', className)}>{children}</ul>
	)
}

const rowWidths = {
	narrow: 'sm:grid-cols-[13rem_1fr]',
	medium: 'sm:grid-cols-[15rem_1fr]',
	wide: 'sm:grid-cols-[19rem_1fr]',
} as const

function PanelRowLabel({
	variant,
	size,
	children,
}: {
	variant: 'code' | 'text' | 'plain'
	size: 'sm' | 'xs'
	children: React.ReactNode
}) {
	if (variant === 'code') {
		return (
			<code className={cn('font-mono text-foreground', size === 'xs' ? 'text-xs' : 'text-sm')}>
				{children}
			</code>
		)
	}

	if (variant === 'text') return <p className="text-sm font-medium">{children}</p>

	return children
}

/** One label/description row in a {@link PanelList}. */
export function PanelRow({
	label,
	children,
	width = 'narrow',
	labelVariant = 'code',
	labelSize = 'sm',
}: {
	label: React.ReactNode
	children: React.ReactNode
	width?: keyof typeof rowWidths
	labelVariant?: 'code' | 'text' | 'plain'
	labelSize?: 'sm' | 'xs'
}) {
	return (
		<li className={cn('grid gap-1 border-t px-5 py-3 first:border-t-0 sm:gap-4', rowWidths[width])}>
			<PanelRowLabel variant={labelVariant} size={labelSize}>
				{label}
			</PanelRowLabel>
			<p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
		</li>
	)
}

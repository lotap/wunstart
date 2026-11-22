import {createFileRoute} from '@tanstack/react-router'

import {pageMeta} from '#/lib/page-meta.ts'

/** Placeholder: replace with your plans, or delete this route and its header link. */
export const Route = createFileRoute('/_auth-anon/pricing')({
	component: PricingPage,
	head: () => ({
		meta: pageMeta('Pricing', 'A placeholder pricing page for your product.'),
	}),
})

function PricingPage() {
	return (
		<section className="mx-auto flex min-h-svh w-full max-w-5xl flex-col justify-center gap-4 px-2 py-16">
			<p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
				Example page
			</p>
			<h1 className="font-heading text-3xl tracking-tight">Pricing</h1>
			<p className="max-w-prose text-base text-muted-foreground">
				This is a placeholder pricing page. Replace it with your plans, or remove this route and the
				Pricing link in the header.
			</p>
		</section>
	)
}

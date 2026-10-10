import {GrainGradient} from '@paper-design/shaders-react'
import {createFileRoute} from '@tanstack/react-router'
import {cn} from 'cn'
import {Dot, Globe} from 'lucide-react'

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'
import {Dashboard} from '#/components/dashboard.tsx'

export const Route = createFileRoute('/_auth-dynamic/')({
	component: Home,
})

const SlashGrid = ({
	className,
	contentLength = 60,
}: {
	className?: string
	contentLength?: number
}) => (
	<div aria-hidden="true" className={cn('grid w-full grid-cols-60 select-none', className)}>
		{Array.from({length: contentLength}).map((_, i) => (
			// oxlint-disable-next-line react/no-array-index-key
			<span key={i} className="text-center font-mono text-muted-foreground">
				/
			</span>
		))}
	</div>
)

/** Top of the welcome section: 2 rows on mobile, 3 rows on sm+ */
const TopRule = () => (
	<>
		<SlashGrid className="sm:hidden" contentLength={60 * 2} />
		<SlashGrid className="hidden sm:grid" contentLength={60 * 3} />
	</>
)

/** Between the Welcome bar and the tall content block: full-width, 2 rows */
const MiddleRule = () => <SlashGrid contentLength={60 * 2} />

/** Bottom of the welcome section: 3 rows */
const BottomRule = () => <SlashGrid contentLength={60 * 3} />

/** Single-row divider around the Get started heading */
const GetStartedRule = () => <SlashGrid className="grid-cols-40" contentLength={40} />

/** Right gutter of the Welcome bar: width grows with the viewport */
const WelcomeGutter = () => (
	<>
		<SlashGrid className="w-1/12 grid-cols-5 sm:hidden" contentLength={5 * 2} />
		<SlashGrid className="hidden w-1/4 grid-cols-15 sm:grid md:hidden" contentLength={15 * 2} />
		<SlashGrid className="hidden w-1/3 grid-cols-20 md:grid" contentLength={20 * 2} />
	</>
)

/**
 * Flanking gutters of the tall content block. Row counts are per-breakpoint
 * height estimates (the text column wraps differently at each width).
 */
const TallGutterLeft = () => (
	<>
		<SlashGrid className=" w-1/12 grid-cols-5 sm:hidden" contentLength={5 * 36} />
		<SlashGrid className="hidden w-1/12 grid-cols-5 sm:grid md:hidden" contentLength={5 * 26} />
		<SlashGrid className="hidden w-1/12 grid-cols-5 md:grid" contentLength={5 * 25} />
	</>
)

/** Right gutter of the tall content block: width grows with the viewport */
const TallGutterRight = () => (
	<>
		<SlashGrid className="w-1/12 grid-cols-5 sm:hidden" contentLength={5 * 36} />
		<SlashGrid className="hidden w-1/4 grid-cols-15 sm:grid md:hidden" contentLength={15 * 26} />
		<SlashGrid className="hidden w-1/3 grid-cols-20 md:grid" contentLength={20 * 25} />
	</>
)

function Home() {
	const {auth} = Route.useRouteContext()

	if (auth) {
		return <Dashboard />
	}

	return (
		<div className="mx-auto flex flex-col items-center gap-12 px-2 py-6">
			<section className="flex w-full max-w-5xl flex-col gap-2 sm:flex-row">
				<div className="flex sm:order-2 sm:items-end md:w-1/3 md:justify-end">
					<h2 className="flex flex-col py-12 text-4xl">
						<span>Build </span>
						<span>for </span>
						<span className="font-serif font-black italic dark:font-bold">humans </span>
						<span className="text-muted-foreground">with </span>
						<span className="text-muted-foreground">agents</span>
					</h2>
				</div>

				<div aria-hidden="true" className="h-56 w-full sm:order-1 sm:h-128 md:w-2/3">
					<GrainGradient
						width="100%"
						height="100%"
						colors={['#ffffff']}
						colorBack="#0a0a0a"
						softness={0.5}
						intensity={0.75}
						noise={1}
						// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names
						shape="ripple"
						speed={1}
						rotation={180}
					/>
				</div>
			</section>

			<section className="w-full max-w-5xl">
				<TopRule />
				<div className="flex items-center">
					<div className="flex w-full">
						<SlashGrid className="w-1/12 grid-cols-5" contentLength={5 * 2} />
						<div className="flex grow items-center justify-between px-6">
							<h3 className="text-3xl">Welcome</h3>
							<div aria-hidden="true" className="flex text-muted-foreground">
								<Globe className="size-4" />
								<Globe className="size-4" />
								<Globe className="size-4" />
								<Globe className="size-4" />
								<Globe className="size-4" />
								<Globe className="size-4" />
							</div>
						</div>
						<WelcomeGutter />
					</div>
				</div>
				<MiddleRule />

				<div className="flex">
					<TallGutterLeft />
					<div className="w-5/6 p-6 sm:w-2/3 md:w-7/12">
						<p className="text-2xl">Thank you for installing wunstart!</p>

						<p className="pt-6 text-2xl">
							You’re ready to produce code that’s readable for humans, predictable for agents, and
							scalable for users
						</p>

						<p className="pt-12 text-sm tracking-widest uppercase">Featuring:</p>
						<ul className="flex flex-col gap-2 pt-4 text-lg">
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Example home, pricing, and settings pages</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Pre-wired email auth</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Working theme-toggle</span>
							</li>
						</ul>

						<p className="pt-12 text-sm tracking-widest uppercase">Turbo-charged by:</p>
						<ul className="flex flex-col gap-2 pt-4 text-lg">
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Tanstack Start configured with Tailwind &amp; shadcn</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Effect (v4) for backend operations</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Drizzle ORM connected to Postgres and Hyperdrive</span>
							</li>
						</ul>
					</div>
					<TallGutterRight />
				</div>
				<BottomRule />
			</section>

			<div className="w-full bg-muted bg-linear-to-b from-background to-muted py-12">
				<section className="mx-auto flex w-full max-w-5xl gap-6 rounded-lg from-background to-muted">
					<div aria-hidden="true" className="w-1/3">
						<GrainGradient
							width="100%"
							height="100%"
							colors={['#ffffff']}
							colorBack="#0a0a0a"
							softness={0.5}
							intensity={0.75}
							noise={1}
							// oxlint-disable-next-line anti-slop/no-shape-in-symbol-names
							shape="truchet"
							speed={1}
							rotation={180}
							scale={0.5}
						/>
					</div>
					<div className="w-2/3">
						<GetStartedRule />
						<h3 className="text-3xl">Get started</h3>
						<GetStartedRule />
						<p className="pt-6 text-2xl">
							Customize this page at: <br /> <code>"/_auth-dynamic/index.tsx"</code>
						</p>
						<p className="pt-6 text-2xl">
							When you sign in, this route (<code>"/"</code>) will display the{' '}
							<code>&lt;Dashboard /&gt;</code> component
						</p>
						<p className="pt-6 text-2xl">Create an account using the form below</p>
					</div>
				</section>
			</div>

			<section>
				<SignUpForm />
			</section>
		</div>
	)
}

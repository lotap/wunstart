import {GrainGradient} from '@paper-design/shaders-react'
import {createFileRoute} from '@tanstack/react-router'
import {cn} from 'cn'
import {Dot} from 'lucide-react'

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
			<div
				// oxlint-disable-next-line react/no-array-index-key
				key={i}
				className="text-center font-mono text-base leading-tight text-muted-foreground/50 transition-transform hover:rotate-90"
			>
				/
			</div>
		))}
	</div>
)

/** Top of the welcome section */
const TopRule = () => (
	<div className="flex items-center gap-2">
		<SlashGrid className="w-1/3 grid-cols-20 sm:hidden" contentLength={20} />
		<SlashGrid className="hidden w-2/3 grid-cols-40 sm:grid lg:hidden" contentLength={40} />
		<SlashGrid className="hidden w-3/4 grid-cols-45 lg:grid" contentLength={45} />
		<p className="grow text-right font-mono text-xs tracking-widest whitespace-nowrap text-muted-foreground/75 uppercase">
			<span>ROUTE: &quot;/&quot;</span> <span className="text-muted-foreground/50">/</span>{' '}
			<span>AUTH: ANON</span>
		</p>
	</div>
)

/** Between the Welcome bar and the tall content block: abuts the gutter */
const MiddleRule = () => <SlashGrid contentLength={60} />

/** Bottom of the welcome section: abuts the gutter */
const BottomRule = () => <SlashGrid contentLength={60 * 2} />

/** Single-row divider around the Get started heading */
const GetStartedRule = () => <SlashGrid className="grid-cols-40" contentLength={40} />

/** Right gutter of the Welcome bar: width grows with the viewport */
const TallGutterRight = () => (
	<>
		<SlashGrid className="w-1/6 grid-cols-10 sm:hidden" contentLength={10 * 40} />
		<SlashGrid className="hidden w-1/4 grid-cols-15 sm:grid md:hidden" contentLength={15 * 30} />
		<SlashGrid className="hidden w-1/3 grid-cols-20 md:grid lg:hidden" contentLength={20 * 30} />
		<SlashGrid className="hidden w-5/12 grid-cols-25 lg:grid" contentLength={25 * 30} />
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
				<div className="flex grow sm:order-2 sm:items-end md:justify-end">
					<h2 className="flex flex-col py-12 text-4xl">
						<span>Build </span>
						<span>for </span>
						<span className="font-serif font-black italic dark:font-bold">humans </span>
						<span className="text-muted-foreground">with </span>
						<span className="text-muted-foreground">agents</span>
					</h2>
				</div>

				<div
					aria-hidden="true"
					className="h-56 w-full animate-in bg-foreground/50 fade-in sm:order-1 sm:h-128 sm:w-3/4 md:w-2/3"
				>
					<GrainGradient
						width="100%"
						height="100%"
						colors={['#ffffff']}
						colorBack="#0a0a0a"
						softness={0.3}
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

				<h3 className="px-6 py-3 text-3xl">Welcome</h3>

				<MiddleRule />

				<div className="flex pt-6">
					<div className="w-5/6 px-6 py-3 sm:w-3/4 md:w-2/3 lg:w-7/12">
						<p className="text-2xl">Thank you for installing wunstart!</p>

						<p className="pt-12 text-lg">
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

						<p className="pt-6 text-sm tracking-widest uppercase">Turbo-charged by:</p>
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

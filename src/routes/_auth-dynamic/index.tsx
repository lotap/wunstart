import {GrainGradient} from '@paper-design/shaders-react'
import {createFileRoute} from '@tanstack/react-router'
import {cn} from 'cn'
import {Check, Copy, Dot} from 'lucide-react'
import {useState} from 'react'

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'
import {Dashboard} from '#/components/dashboard.tsx'
import {Button} from '#/components/ui/button.tsx'
import {Card, CardContent} from '#/components/ui/card.tsx'
import {toast} from '#/components/ui/toast.tsx'
import {Tooltip, TooltipContent, TooltipTrigger} from '#/components/ui/tooltip.tsx'

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

const agentPrompts: Array<{label: string; body: string}> = [
	{
		label: '1 — Show me around',
		body: 'I just got this running. Can you show me around and help me check it works? Walk me through creating an account, finding the passcode email in Mailpit (the URL is in .env.local), signing in, and opening settings. Tell me what to click and what I should see, and help me fix anything that’s broken before I start changing things.',
	},
	{
		label: '2 — Make it mine',
		body: 'I want this to feel like my app, not a starter. Ask me about the name, audience, and tone, then update the app identity, landing page, and theme tokens. Strip the starter copy that doesn’t fit, but leave the auth flow alone. Show me the result and tell me what changed.',
	},
	{
		label: '3 — Build my first screen',
		body: 'The dashboard is a stub. Help me turn it into the first real screen of my app. Ask me what it should show, then build it end to end — data, server logic, and UI — using the patterns already in the repo. Run fmt, lint:check, and tsc, then tell me where to click.',
	},
	{
		label: '4 — Get ready to ship',
		body: 'I want to know what it will take to put this online. Give me a checklist covering secrets and env vars, the production database and migrations, real email delivery, and anything still stubbed or unfinished. Don’t deploy anything yet — flag the gaps and ask me what to tackle first.',
	},
]

function CopyPromptButton({text, label}: {text: string; label: string}) {
	const [copied, setCopied] = useState(false)
	const [tooltipOpen, setTooltipOpen] = useState(false)
	const [tooltipText, setTooltipText] = useState('Copy prompt')

	return (
		<>
			<Tooltip
				open={copied || tooltipOpen}
				onOpenChange={setTooltipOpen}
				onOpenChangeComplete={(open) => {
					if (!open) setTooltipText('Copy prompt')
				}}
			>
				<TooltipTrigger
					delay={300}
					closeOnClick={false}
					render={
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label={copied ? 'Copied to clipboard' : `Copy prompt: ${label}`}
							onClick={async () => {
								try {
									await navigator.clipboard.writeText(text)
									setCopied(true)
									setTooltipText('Copied')
									setTimeout(() => {
										setCopied(false)
										setTooltipOpen(false)
									}, 2000)
								} catch {
									toast.add({title: 'Could not copy prompt', type: 'error'})
								}
							}}
						>
							{copied ? <Check /> : <Copy />}
						</Button>
					}
				/>
				<TooltipContent side="top" className="motion-reduce:animate-none!">
					{tooltipText}
				</TooltipContent>
			</Tooltip>
			{copied && <output className="sr-only">Copied to clipboard</output>}
		</>
	)
}

function PromptCard({label, body}: {label: string; body: string}) {
	return (
		<Card size="sm">
			<CardContent className="flex items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
						{label}
					</p>
					<p className="font-mono text-sm whitespace-pre-wrap">{body}</p>
				</div>
				<CopyPromptButton text={body} label={label} />
			</CardContent>
		</Card>
	)
}

function Home() {
	const {auth} = Route.useRouteContext()

	if (auth) {
		return <Dashboard />
	}

	return (
		<div className="mx-auto flex flex-col items-center gap-12 px-2 py-6">
			{/* HERO */}
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

			{/* WELCOME */}
			<section className="w-full max-w-5xl">
				{/* // TOP LINE */}
				<div className="flex items-center gap-2">
					<SlashGrid className="w-1/3 grid-cols-20 sm:hidden" contentLength={20} />
					<SlashGrid className="hidden w-2/3 grid-cols-40 sm:grid lg:hidden" contentLength={40} />
					<SlashGrid className="hidden w-3/4 grid-cols-45 lg:grid" contentLength={45} />
					<p className="grow text-right font-mono text-xs tracking-widest whitespace-nowrap text-muted-foreground/75 uppercase">
						<span>ROUTE: &quot;/&quot;</span> <span className="text-muted-foreground/35">/</span>{' '}
						<span>AUTH: ANON</span>
					</p>
				</div>

				{/* HEADER */}
				<h3 className="px-6 py-3 text-3xl">Welcome to the happy path</h3>

				{/* // DIVIDER */}
				<SlashGrid />

				<div className="flex pt-6">
					{/* BODY COPY */}
					<div className="flex w-5/6 flex-col gap-6 px-6 py-3 sm:w-3/4 md:w-2/3 lg:w-7/12 **:[a]:underline">
						<p className="text-2xl">Thank you for installing wunstart!</p>

						<p>
							This codebase provides you (and your agents) a strong foundation to build and deploy
							your next webapp.
						</p>

						<p>
							The patterns within are designed to strike the right balance of readable and
							repeatable; something that agents can detect and copy without introducing code-slop
							that leads to a feedback-loop of rot.
						</p>

						<p>
							<a href="https://wunshot.dev/" target="_blank" rel="noreferrer">
								wunshot
							</a>{' '}
							is the core of the project. This is a fullstack implementation of the primitives it
							produces.
						</p>

						<p className="mt-4 text-sm tracking-widest uppercase">Featuring:</p>
						<ul className="-mt-2 flex flex-col gap-2 text-lg">
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								End-to-end type safety
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Pre-wired email auth</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Placeholder home, pricing, dashboard, and settings pages</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>Working basic account preferences and theme-toggle</span>
							</li>
						</ul>

						<p className="mt-4 text-sm tracking-widest uppercase">Turbo-charged by:</p>
						<p className="-mt-4 text-xs text-muted-foreground">Frontend</p>
						<ul className="-mt-4 flex flex-col gap-2 text-lg">
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://tanstack.com/start/latest" target="_blank" rel="noreferrer">
										TanStack Start
									</a>{' '}
									- File-based routing with server-side rendering, streaming, and server functions
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://tailwindcss.com/" target="_blank" rel="noreferrer">
										tailwindcss
									</a>{' '}
									- Utility first CSS for consistent straightforward style editing
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://ui.shadcn.com/" target="_blank" rel="noreferrer">
										shadcn/ui
									</a>{' '}
									- Composable accessible components for building design systems
								</span>
							</li>
						</ul>

						<p className="text-xs text-muted-foreground">Backend</p>
						<ul className="-mt-4 flex flex-col gap-2 text-lg">
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://effect.website/" target="_blank" rel="noreferrer">
										Effect
									</a>{' '}
									- Resilient system designs for backend operations
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://orm.drizzle.team/" target="_blank" rel="noreferrer">
										Drizzle ORM
									</a>{' '}
									- Speedy type-safe typescript ORM
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://www.postgresql.org/" target="_blank" rel="noreferrer">
										PostgreSQL
									</a>{' '}
									- Tried and trusted scalable and flexible database
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a
										href="https://www.cloudflare.com/products/hyperdrive/"
										target="_blank"
										rel="noreferrer"
									>
										Cloudflare Hyperdrive
									</a>{' '}
									(optional) - Make accessing your db fast for users around the globe
								</span>
							</li>
						</ul>

						<p className="text-xs text-muted-foreground">Code Consistency</p>
						<ul className="-mt-4 flex flex-col gap-2 text-lg">
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://oxc.rs/docs/guide/usage/linter" target="_blank" rel="noreferrer">
										Oxlint
									</a>{' '}
									- Rules to keep your codebase consistent and efficient
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://github.com/dmmulroy/anti-slop" target="_blank" rel="noreferrer">
										anti-slop
									</a>{' '}
									- Rules that reject low-evidence and low-signal TypeScript and JavaScript patterns
								</span>
							</li>
							<li className="flex items-start">
								<Dot aria-hidden="true" className="size-7 shrink-0 text-muted-foreground" />
								<span>
									<a href="https://www.react.doctor/" target="_blank" rel="noreferrer">
										React Doctor
									</a>{' '}
									- Rules that keep{' '}
									<a href="https://react.dev/" target="_blank" rel="noreferrer">
										React
									</a>{' '}
									code performant
								</span>
							</li>
						</ul>

						<Card className="bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20">
							<CardContent>
								Testing utilities/frameworks are not included while I investigate the best way to
								provide tests that are robust without adding excess noise.
								<br />
								<br />
								They will be added in a future release
							</CardContent>
						</Card>
					</div>

					{/* // GUTTER */}
					<SlashGrid className="w-1/6 grid-cols-10 sm:hidden" contentLength={10 * 110} />
					<SlashGrid
						className="hidden w-1/4 grid-cols-15 sm:grid md:hidden"
						contentLength={15 * 80}
					/>
					<SlashGrid
						className="hidden w-1/3 grid-cols-20 md:grid lg:hidden"
						contentLength={20 * 80}
					/>
					<SlashGrid className="hidden w-5/12 grid-cols-25 lg:grid" contentLength={25 * 70} />
				</div>
				{/* // BOTTOM LINE */}
				<SlashGrid contentLength={60 * 2} />
			</section>

			{/* GET STARTED */}
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
						<SlashGrid className="grid-cols-40" contentLength={40} />
						<h3 className="text-3xl">Get started</h3>
						<SlashGrid className="grid-cols-40" contentLength={40} />
						<p className="pt-6 text-2xl">
							Customize this page at: <br /> <code>"/_auth-dynamic/index.tsx"</code>
						</p>
						<p className="pt-6 text-2xl">
							When you sign in, this route (<code>"/"</code>) will display the{' '}
							<code>&lt;Dashboard /&gt;</code> component
						</p>
						<div className="flex flex-col gap-4 pt-6">
							<p className="text-sm tracking-widest uppercase">Example prompts</p>
							<p className="text-lg">Paste into your preferred harness.</p>
							{agentPrompts.map((prompt) => (
								<PromptCard key={prompt.label} label={prompt.label} body={prompt.body} />
							))}
						</div>
						<p className="pt-6 text-2xl">Create an account using the form below</p>
						<p className="pt-2 text-sm text-muted-foreground">
							Local sign-up emails land in Mailpit — the URL is <code>MAILPIT_URL</code> in{' '}
							<code>.env.local</code>.
						</p>
					</div>
				</section>
			</div>

			{/* SIGN UP */}
			<section>
				<SignUpForm />
			</section>
		</div>
	)
}

import {SignUpForm} from '#/components/auth/sign-up-form.tsx'

import {DirectorySection} from './directory-section.tsx'
import {Hero} from './hero.tsx'
import {PromptCard} from './prompt-card.tsx'
import {QuickLinksSection} from './quick-links-section.tsx'
import {SlashGrid} from './slash-grid.tsx'

const homePrompt =
	'Edit the anonymous home page at src/routes/_auth-dynamic/(home)/-components/anon/home.tsx. Ask me for the product name, audience, and tone first. Keep the route and auth behavior intact, then replace the starter layout and copy to fit my product and show me what changed.'

function SectionNotice() {
	return (
		<p className="w-full max-w-5xl px-6 text-center font-mono text-xs tracking-widest text-muted-foreground uppercase">
			This page is meant to be overwritten.{' '}
			<a
				href="#get-started"
				className="underline decoration-muted-foreground/60 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
			>
				Get started
			</a>
		</p>
	)
}

export function AnonHome() {
	return (
		<div className="mx-auto flex flex-col items-center gap-12 px-2 py-6">
			<Hero />

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
				<h2 className="px-6 py-3 font-heading text-3xl">Welcome to the happy path</h2>

				{/* // DIVIDER */}
				<SlashGrid />

				{/* BODY COPY */}
				<div className="flex pt-6">
					<div className="flex w-5/6 flex-col gap-6 px-6 py-3 sm:w-3/4 md:w-2/3 lg:w-7/12">
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
							<a href="https://wunshot.dev/" target="_blank" rel="noreferrer" className="underline">
								wunshot
							</a>{' '}
							is the core of the project. This is a fullstack implementation of the primitives it
							produces.
						</p>
					</div>

					{/* // GUTTER */}
					<SlashGrid className="w-1/6 grid-cols-10 sm:hidden" contentLength={10 * 16} />
					<SlashGrid
						className="hidden w-1/4 grid-cols-15 sm:grid md:hidden"
						contentLength={15 * 16}
					/>
					<SlashGrid
						className="hidden w-1/3 grid-cols-20 md:grid lg:hidden"
						contentLength={20 * 14}
					/>
					<SlashGrid className="hidden w-5/12 grid-cols-25 lg:grid" contentLength={25 * 14} />
				</div>
				{/* // BOTTOM LINE */}
				<SlashGrid contentLength={60 * 2} />
			</section>

			{/* QUICK LINKS */}
			<SectionNotice />
			{import.meta.env.DEV && <QuickLinksSection />}

			{/* DIRECTORY */}
			{import.meta.env.DEV && <SectionNotice />}
			<DirectorySection />

			{/* GET STARTED */}
			<SectionNotice />
			<section
				id="get-started"
				aria-labelledby="get-started-title"
				className="w-full max-w-5xl scroll-mt-6"
			>
				<SlashGrid />
				<h2 id="get-started-title" className="px-6 py-3 text-right font-heading text-3xl">
					Get started
				</h2>
				<SlashGrid />

				<div className="flex pt-6">
					{/* // GUTTER */}
					<SlashGrid className="w-1/6 grid-cols-10 sm:hidden" contentLength={10 * 30} />
					<SlashGrid
						className="hidden w-1/4 grid-cols-15 sm:grid md:hidden"
						contentLength={15 * 29}
					/>
					<SlashGrid
						className="hidden w-1/3 grid-cols-20 md:grid lg:hidden"
						contentLength={20 * 27}
					/>
					<SlashGrid className="hidden w-5/12 grid-cols-25 lg:grid" contentLength={25 * 28} />

					<div className="flex w-5/6 flex-col gap-10 px-6 pt-3 pb-6 sm:w-3/4 md:w-2/3 lg:w-7/12">
						<section aria-labelledby="customizing-this-page" className="flex flex-col gap-4">
							<h3 id="customizing-this-page" className="font-heading text-xl">
								Customizing this page
							</h3>
							<p className="text-lg">
								Customize this page at{' '}
								<code className="font-mono break-all">
									src/routes/_auth-dynamic/(home)/-components/anon/home.tsx
								</code>
								.
							</p>
							<p className="text-sm leading-relaxed text-muted-foreground">
								Edit the page directly using React and shadcn/ui components with Tailwind. Or have
								an agent do it for you.
							</p>
							<PromptCard label="Example prompt" body={homePrompt} />
						</section>

						<section aria-labelledby="exploring-the-user-flow" className="flex flex-col gap-4">
							<h3 id="exploring-the-user-flow" className="font-heading text-xl">
								Exploring the user flow
							</h3>
							<p className="text-sm leading-relaxed text-muted-foreground">
								Use the sign-up form below to create an account and see what the onboarding flow is
								like for a user.
							</p>
							<p className="text-sm leading-relaxed text-muted-foreground">
								Local sign-up emails land in Mailpit — the URL is{' '}
								<code className="font-mono text-foreground">MAILPIT_URL</code> in{' '}
								<code className="font-mono text-foreground">.env.local</code>.
							</p>
						</section>
					</div>
				</div>

				<SlashGrid contentLength={60 * 2} />
			</section>

			<div className="h-24 w-full rounded-2xl bg-linear-to-b from-background to-muted md:h-36" />

			{/* SIGN UP */}
			<section>
				<SignUpForm />
			</section>
		</div>
	)
}

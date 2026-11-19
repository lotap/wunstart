import {SiGithub} from '@icons-pack/react-simple-icons'
import {Link} from '@tanstack/react-router'
import {ArrowRight, ArrowUpRight} from 'lucide-react'

import {appInfo} from '#/app-info.ts'

import {Wordmark} from '../wordmark.tsx'
import {FooterImage} from './_footer-image.tsx'
import {FooterUtility} from './_footer-utility.tsx'

export function ExternalFooter() {
	return (
		<footer className="relative flex min-h-svh flex-col font-normal [clip-path:inset(0)] dark:text-background">
			{/* Fixed + clipped so the image stays put like background-attachment: fixed. */}
			<div aria-hidden="true" className="pointer-events-none fixed inset-0">
				<FooterImage className="h-full w-full" />
			</div>

			<div
				aria-hidden="true"
				className="pointer-events-none fixed inset-0 bg-linear-to-b from-white/40 from-20% via-transparent via-50% to-black/25"
			/>

			{/* White + difference inverts against whatever is behind the text. */}
			<div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-12 text-white mix-blend-difference">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
					<div className="max-w-xl">
						<p className="max-w-lg text-3xl font-medium tracking-tight md:text-4xl">
							Webdev is finally solved.
						</p>
						<Link
							to="/sign-up"
							className="group/cta mt-5 inline-flex items-center gap-2 rounded-full border border-current/70 px-4 py-2 text-sm font-medium transition-colors hover:border-white hover:bg-white hover:text-black focus-visible:ring-2 focus-visible:ring-current/50 focus-visible:outline-none"
						>
							Start building
							<ArrowRight
								aria-hidden="true"
								className="size-4 transition-transform delay-100 duration-200 ease-out group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
							/>
						</Link>
					</div>

					<nav
						aria-label="Footer"
						className="flex flex-wrap gap-x-10 gap-y-2 text-sm lg:gap-16 lg:text-right"
					>
						<div>
							<p className="hidden text-xs font-medium tracking-[0.18em] uppercase lg:block">
								Explore
							</p>
							<ul className="flex flex-row gap-4 lg:mt-3 lg:flex-col lg:gap-2">
								<li>
									<Link
										to="/landing-page"
										className="whitespace-nowrap underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
									>
										Landing page
									</Link>
								</li>
								{import.meta.env.DEV && (
									<li>
										<Link
											to="/docs"
											className="whitespace-nowrap underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
										>
											Docs
										</Link>
									</li>
								)}
							</ul>
						</div>
						<div>
							<p className="hidden text-xs font-medium tracking-[0.18em] uppercase lg:block">
								Connect
							</p>
							<ul className="flex flex-row gap-4 lg:mt-3 lg:flex-col lg:gap-2">
								<li>
									<a
										href="https://github.com/lotap/wunstart"
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1.5 whitespace-nowrap underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
									>
										<SiGithub aria-hidden="true" className="size-4" />
										GitHub
										<ArrowUpRight aria-hidden="true" className="size-3.5" />
									</a>
								</li>
							</ul>
						</div>
					</nav>
				</div>

				<div className="mt-auto pt-16">
					<Link to="/" aria-label={`${appInfo.name} home`} className="block">
						<Wordmark className="block h-auto w-full" />
					</Link>

					<FooterUtility className="mt-4" />
				</div>
			</div>
		</footer>
	)
}

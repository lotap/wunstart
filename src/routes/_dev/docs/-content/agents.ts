type SkillGroup = {
	title: string
	description: string
	owned: boolean
	skills: Array<{name: string; description: string; badge?: string}>
}

/** Skills available to agents in this repo. */
export const skillGroups: SkillGroup[] = [
	{
		title: 'Project skills',
		description: 'Maintained here. They cover how this app is wired and how its data layer works.',
		owned: true,
		skills: [
			{
				name: 'wunstart',
				description:
					'App wiring: routes, server functions, middleware, cookies, forms, email, styling, and Workers.',
			},
			{
				name: 'wunshot',
				description:
					'Database modules: tables, queries, validations, archive pairs, ops, auth, and bans.',
			},
		],
	},
	{
		title: 'Stack references',
		description: 'Vendored docs for the tools this app is built on.',
		owned: false,
		skills: [
			{
				name: 'effect',
				description: 'Effect v4 workflows, services, schemas, layers, and tests.',
			},
			{
				name: 'shadcn',
				description: 'Component composition, registries, and styling rules.',
			},
			{
				name: 'tanstack-query',
				description: 'Server state, caching, invalidation, and query patterns.',
			},
			{
				name: 'tanstack-form',
				description: 'Form state and field-level validation.',
			},
			{
				name: 'react-email',
				description: 'Email templates and rendering.',
			},
			{
				name: 'workers-best-practices',
				description: 'Workers runtime, configuration, limits, and observability.',
			},
			{
				name: 'wrangler',
				description: 'Local development, previews, deploys, and resource commands.',
			},
			{
				name: 'cloudflare',
				description: 'Cloudflare product selection when a task needs a platform service.',
			},
		],
	},
	{
		title: 'Quality and support',
		description: 'Audits, lint maintenance, and setup guidance for the toolchain itself.',
		owned: false,
		skills: [
			{
				name: 'improve-react',
				description: 'Read-only React audit that produces prioritized implementation plans.',
			},
			{
				name: 'web-perf',
				description: 'Performance and Core Web Vitals audits.',
			},
			{
				name: 'install-anti-slop',
				description: 'Install, update, or migrate the vendored anti-slop lint rules.',
			},
			{
				name: 'effect-ts',
				description: 'Setup guidance when a repository is adding Effect.',
				badge: 'setup',
			},
			{
				name: 'tanstack-start',
				description:
					'Bundled but intentionally ignored: it documents the Vinxi-era API. wunstart covers modern Start.',
				badge: 'ignored',
			},
		],
	},
]

/** External skill collections worth browsing. */
export const recommendedSkills = [
	{
		name: 'Emil Kowalski’s skills',
		description:
			'Design engineering, animation, mobile, and edge-case UI skills. Install the collection with npx skills add emilkowalski/skills.',
		href: 'https://github.com/emilkowalski/skills',
	},
	{
		name: 'bro-skill',
		description: 'Re-explains a dense answer in plain language. The README has its installer.',
		href: 'https://github.com/luchasarie/bro-skill/tree/main',
	},
] as const

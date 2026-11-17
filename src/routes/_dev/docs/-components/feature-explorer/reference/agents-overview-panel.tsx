import {ExternalDocLink} from '#/components/global/external-doc-link.tsx'

import {CodeBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelSection, Prose} from '../../doc-ui.tsx'

type SkillGroup = {
	title: string
	description: string
	owned: boolean
	skills: Array<{name: string; description: string; badge?: string}>
}

/** Skills available to agents in this repo. */
const skillGroups: SkillGroup[] = [
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
const recommendedSkills = [
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

/** Optional MCP servers that give agents browser and documentation tools. */
const recommendedMcpServers = [
	{
		name: 'Chrome DevTools MCP',
		description:
			'Browser automation and inspection: navigate, click, fill, read console and network logs, capture screenshots, and record performance traces. This repo’s opencode.json already enables it.',
		href: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
	},
	{
		name: 'Context7',
		description:
			'Version-specific library documentation on demand. Use it when a vendored skill does not cover a library or the API has moved. Setup and API key details are in the README.',
		href: 'https://github.com/upstash/context7',
	},
] as const

const totalSkills = skillGroups.reduce((total, group) => total + group.skills.length, 0)

const projectSkillCount = skillGroups
	.filter((group) => group.owned)
	.reduce((total, group) => total + group.skills.length, 0)

export function AgentsOverviewPanel() {
	return (
		<>
			<PanelHeader
				title="Agents overview"
				description="The context files, skills, and MCP tools agents use before changing this repo."
			/>

			<dl className="mt-8 grid gap-4 sm:grid-cols-2">
				<div className="flex flex-col gap-1 border-t pt-3">
					<dt>
						<code className="font-mono text-sm text-foreground">AGENTS.md</code>
					</dt>
					<dd className="text-sm leading-relaxed text-muted-foreground">
						The commands, hard rules, and verification steps for working in this repo. Agents read
						it first; it is the best place to see how changes are expected to land.
					</dd>
				</div>
				<div className="flex flex-col gap-1 border-t pt-3">
					<dt>
						<code className="font-mono text-sm text-foreground">CONTEXT.md</code>
					</dt>
					<dd className="text-sm leading-relaxed text-muted-foreground">
						The product glossary. Add domain terms here so copy, code, and agents use the same
						language as the app grows.
					</dd>
				</div>
			</dl>

			<section aria-labelledby="skills-included" className="mt-8">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex flex-col gap-1">
						<h5 id="skills-included" className="font-heading text-lg font-medium">
							Skills included
						</h5>
						<p className="max-w-2xl text-sm text-muted-foreground">
							Plain Markdown, grouped by the work they cover. The project skills are maintained
							here; everything else is a vendored reference.
						</p>
					</div>
					<p className="shrink-0 font-mono text-xs text-muted-foreground">
						{totalSkills} skills · {projectSkillCount} project-owned
					</p>
				</div>

				<div className="mt-5 overflow-hidden rounded-xl border bg-muted/20">
					{skillGroups.map((group) => (
						<section
							key={group.title}
							aria-label={group.title}
							className="border-t first:border-t-0"
						>
							<header className="flex flex-col gap-1 bg-muted/30 px-5 py-4">
								<div className="flex items-baseline justify-between gap-3">
									<h6 className="text-sm font-medium">{group.title}</h6>
									<span className="font-mono text-xs text-muted-foreground">
										{group.skills.length} skills
									</span>
								</div>
								<p className="text-sm text-muted-foreground">{group.description}</p>
							</header>
							<ul>
								{group.skills.map((skill) => (
									<li
										key={skill.name}
										className="grid gap-1 border-t px-5 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4"
									>
										<div className="flex flex-wrap items-center gap-2">
											<code className="font-mono text-sm text-foreground">{skill.name}</code>
											{skill.badge && (
												<span className="rounded-full border px-2 py-0.5 font-mono text-xs text-muted-foreground">
													{skill.badge}
												</span>
											)}
										</div>
										<p className="text-sm leading-relaxed text-muted-foreground">
											{skill.description}
										</p>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			</section>

			<PanelSection id="using-skills" title="Using skills.sh">
				<Prose>
					The <ExternalDocLink href="https://www.skills.sh/docs/cli">skills CLI</ExternalDocLink>{' '}
					installs and refreshes the Markdown files under <InlineCode>.agents/skills</InlineCode>.
					Add a collection by its repository, or pick one skill from it.
				</Prose>
				<div className="grid gap-4 lg:grid-cols-2">
					<div className="flex flex-col gap-3">
						<p className="text-sm font-medium">Install</p>
						<CodeBlock
							code="npx skills add <owner>/<repo>"
							label="Install a collection"
							language="bash"
						/>
						<p className="text-sm leading-relaxed text-muted-foreground">
							Installs every skill in the repository.
						</p>
					</div>

					<div className="flex flex-col gap-3">
						<p className="text-sm font-medium">Update</p>
						<CodeBlock
							code={`npx skills check\nnpx skills update`}
							label="Check and update"
							language="bash"
						/>
						<p className="text-sm leading-relaxed text-muted-foreground">
							<InlineCode>check</InlineCode> lists managed skills that have drifted;{' '}
							<InlineCode>update</InlineCode> rewrites them. Pass a skill name to update one. Review
							the diff before committing.
						</p>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					<Prose>
						Add one skill from a collection with <InlineCode>--skill</InlineCode>:
					</Prose>
					<CodeBlock
						code={`npx skills add <owner>/<repo> \\\n  --skill <name>`}
						label="Install one skill"
						language="bash"
					/>
				</div>

				<Prose>
					Skills are instructions an agent will follow. Review new and updated files before running
					them.
				</Prose>

				<div className="rounded-xl border bg-muted/20 p-4">
					<p className="text-sm font-medium">Owned vs. managed</p>
					<p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
						Edit <InlineCode>wunstart</InlineCode> and <InlineCode>wunshot</InlineCode> here. Every
						other skill is managed by skills.sh; local edits are replaced on{' '}
						<InlineCode>update</InlineCode>, so send fixes upstream instead.
					</p>
				</div>
			</PanelSection>

			<PanelSection id="recommended-skills" title="Recommended skills">
				<Prose>External skill sources. None are installed by default.</Prose>
				<ul className="grid gap-3 sm:grid-cols-2">
					{recommendedSkills.map((skill) => (
						<li key={skill.name} className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4">
							<ExternalDocLink href={skill.href}>
								<code className="font-mono text-sm">{skill.name}</code>
							</ExternalDocLink>
							<p className="text-sm leading-relaxed text-muted-foreground">{skill.description}</p>
						</li>
					))}
				</ul>
			</PanelSection>

			<PanelSection id="recommended-mcp-servers" title="Recommended MCP servers">
				<Prose>
					Optional tools an agent can call. Chrome DevTools MCP is already enabled in{' '}
					<InlineCode>opencode.json</InlineCode>; add others under{' '}
					<InlineCode>mcp.servers</InlineCode>.
				</Prose>
				<ul className="grid gap-3 sm:grid-cols-2">
					{recommendedMcpServers.map((server) => (
						<li key={server.name} className="flex flex-col gap-1 rounded-xl border bg-muted/20 p-4">
							<ExternalDocLink href={server.href}>
								<code className="font-mono text-sm">{server.name}</code>
							</ExternalDocLink>
							<p className="text-sm leading-relaxed text-muted-foreground">{server.description}</p>
						</li>
					))}
				</ul>
			</PanelSection>

			<PanelReferences
				links={[
					{label: 'skills CLI docs', href: 'https://www.skills.sh/docs/cli'},
					{label: 'skills.sh directory', href: 'https://www.skills.sh/'},
				]}
			/>
		</>
	)
}

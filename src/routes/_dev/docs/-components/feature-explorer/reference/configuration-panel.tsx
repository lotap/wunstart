import {PanelReferences} from '../../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection, Prose} from '../../doc-ui.tsx'
import {EnvironmentTable} from './_environment-table.tsx'

/** One-time and per-checkout setup commands. */
const setupCommands = [
	{
		name: 'bun run app-identity',
		description:
			'Sets the app name and description across committed files. Run it once per project.',
	},
	{
		name: 'bun run install-deps',
		description: 'One-time per checkout: dependencies and git hooks.',
	},
	{
		name: 'bun run branch-env',
		description:
			'Provisions the branch database, ports, and .env.local. Re-run after a branch switch or a dropped database.',
	},
	{
		name: 'bun run validate-setup',
		description: 'Checks env, ports, and database. It reports what is wrong and how to fix it.',
	},
]

/** Gates that must pass before a change is done. */
const checks = [
	{
		name: 'bun run fmt',
		description: 'Formats src/ and tools/ with oxfmt. Import and Tailwind order are automatic.',
	},
	{
		name: 'bun run lint:check',
		description:
			'Runs oxlint with --deny-warnings: wunstart, wunshot, anti-slop, and React Doctor rules.',
	},
	{
		name: 'bunx tsc --noEmit',
		description:
			'Type gate. noUnusedLocals and noUnusedParameters make dead bindings fail the check.',
	},
	{
		name: 'bun run test:lint',
		description:
			'Runs the custom linter rule tests with Node. bun --bun breaks the RuleTester. Run it when you edit a rule.',
	},
	{
		name: 'bun run build',
		description: 'Production build, including the committed wasm kernel.',
	},
]

/** Automated setup that is easy to miss. */
const toolchainNotes = [
	{
		name: 'prepare',
		description:
			'Installs the repo’s git hooks and patches the installed TypeScript and oxlint copies for Effect. The +effect-tsgo suffix in bunx tsc --version confirms the patch.',
	},
	{
		name: 'pre-commit',
		description:
			'Blocks a crates/ change that reaches a commit without the rebuilt wasm kernel alongside it.',
	},
	{
		name: 'predev',
		description:
			'Reinstalls dependencies before a dev server starts, so a branch switch or a pull repairs itself.',
	},
	{
		name: 'Effect diagnostics',
		description:
			'tsc and lint:check share most Effect checks. Some findings appear in both on purpose; tsc covers 43 checks the linter cannot. Only errors fail tsc.',
	},
]

export function ConfigurationPanel() {
	return (
		<>
			<PanelHeader
				title="Configuration"
				description="Env files, setup commands, and the project’s environment variables."
			/>

			<PanelSection id="environment-files" title="Environment files">
				<Prose>
					For the dev server and db scripts, file values win over exported shell variables. The
					exception is <InlineCode>archive-old-activities</InlineCode>, which reads an exported{' '}
					<InlineCode>DATABASE_URL</InlineCode> first because production has no files.
				</Prose>
				<dl className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-2 rounded-xl border p-5">
						<dt>
							<code className="font-mono text-sm text-foreground">.env.development</code>
						</dt>
						<dd className="text-base leading-relaxed text-muted-foreground">
							Committed defaults shared by every checkout: <InlineCode>DATABASE_URL</InlineCode>,
							JWT secrets, the local Hyperdrive URL, and the cookie domain.
						</dd>
					</div>
					<div className="flex flex-col gap-2 rounded-xl border p-5">
						<dt>
							<code className="font-mono text-sm text-foreground">.env.local</code>
						</dt>
						<dd className="text-base leading-relaxed text-muted-foreground">
							Gitignored per-checkout values written by <InlineCode>branch-env</InlineCode>:{' '}
							<InlineCode>DATABASE_URL</InlineCode>, <InlineCode>DEV_PORT</InlineCode>,{' '}
							<InlineCode>AGENT_DEV_PORT</InlineCode>, and <InlineCode>MAILPIT_URL</InlineCode>. Add
							your own overrides here; re-running <InlineCode>branch-env</InlineCode> keeps them.
							Delete the file and re-run it to regenerate the managed keys.
						</dd>
					</div>
				</dl>
			</PanelSection>

			<PanelSection id="environment-variables" title="Environment variables">
				<Prose>
					The variables the app and local tooling read. Workers bindings such as{' '}
					<InlineCode>HYPERDRIVE</InlineCode>, <InlineCode>EMAIL</InlineCode>, and{' '}
					<InlineCode>AUTH_HASHER</InlineCode> live in <InlineCode>wrangler.jsonc</InlineCode>.
				</Prose>
				<EnvironmentTable />
			</PanelSection>

			<PanelSection id="setup-commands" title="Setup commands">
				<PanelList>
					{setupCommands.map((command) => (
						<PanelRow key={command.name} label={command.name}>
							{command.description}
						</PanelRow>
					))}
				</PanelList>

				<Prose>
					Commands use Bun. Under npm, put <InlineCode>--</InlineCode> before script flags (
					<InlineCode>npm run branch-env -- --yes</InlineCode>); Bun, Nub, pnpm, yarn, and aube
					forward arguments directly. Switch managers with{' '}
					<InlineCode>bun run install-deps --pm &lt;manager&gt;</InlineCode>.
				</Prose>
			</PanelSection>

			<PanelSection id="checks" title="Checks">
				<Prose>
					There is no product test suite yet. These gates are the check. Run them before you call a
					change done.
				</Prose>
				<PanelList>
					{checks.map((check) => (
						<PanelRow key={check.name} label={check.name}>
							{check.description}
						</PanelRow>
					))}
				</PanelList>

				<Prose>
					<InlineCode>bun run validate-setup</InlineCode> is the health check for env, ports, and
					the database. Warnings are not failures.
				</Prose>
			</PanelSection>

			<PanelSection id="toolchain" title="Toolchain">
				<Prose>Some setup is automatic. These are the moving parts that can surprise you.</Prose>
				<PanelList>
					{toolchainNotes.map((note) => (
						<PanelRow key={note.name} label={note.name}>
							{note.description}
						</PanelRow>
					))}
				</PanelList>
			</PanelSection>

			<PanelReferences
				links={[
					{label: 'Vite env and modes', href: 'https://vite.dev/guide/env-and-mode'},
					{
						label: 'Wrangler configuration',
						href: 'https://developers.cloudflare.com/workers/wrangler/configuration/',
					},
				]}
			/>
		</>
	)
}

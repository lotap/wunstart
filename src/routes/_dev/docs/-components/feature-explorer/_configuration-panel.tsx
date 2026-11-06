import {checks, setupCommands, toolchainNotes} from '../../-content/configuration.tsx'
import {PanelReferences} from '../doc-links.tsx'
import {InlineCode, PanelHeader, PanelList, PanelRow, PanelSection} from '../doc-ui.tsx'
import {EnvironmentTable} from './_environment-table.tsx'

export function ConfigurationPanel() {
	return (
		<>
			<PanelHeader
				title="Configuration"
				description="Env files, setup commands, and the project’s environment variables."
			/>

			<PanelSection
				id="environment-files"
				title="Environment files"
				description={
					<>
						For the dev server and db scripts, file values win over exported shell variables. The
						exception is <InlineCode>archive-old-activities</InlineCode>, which reads an exported{' '}
						<InlineCode>DATABASE_URL</InlineCode> first because production has no files.
					</>
				}
			>
				<dl className="grid gap-4 md:grid-cols-2">
					<div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-5">
						<dt>
							<code className="font-mono text-sm text-foreground">.env.development</code>
						</dt>
						<dd className="text-sm leading-relaxed text-muted-foreground">
							Committed defaults shared by every checkout: <InlineCode>DATABASE_URL</InlineCode>,
							JWT secrets, the local Hyperdrive URL, and the cookie domain.
						</dd>
					</div>
					<div className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-5">
						<dt>
							<code className="font-mono text-sm text-foreground">.env.local</code>
						</dt>
						<dd className="text-sm leading-relaxed text-muted-foreground">
							Gitignored per-checkout values written by <InlineCode>branch-env</InlineCode>:{' '}
							<InlineCode>DATABASE_URL</InlineCode>, <InlineCode>DEV_PORT</InlineCode>,{' '}
							<InlineCode>AGENT_DEV_PORT</InlineCode>, and <InlineCode>MAILPIT_URL</InlineCode>. Add
							your own overrides here; re-running <InlineCode>branch-env</InlineCode> keeps them.
							Delete the file and re-run it to regenerate the managed keys.
						</dd>
					</div>
				</dl>
			</PanelSection>

			<PanelSection
				id="environment-variables"
				title="Environment variables"
				description={
					<>
						The variables the app and local tooling read. Workers bindings such as{' '}
						<InlineCode>HYPERDRIVE</InlineCode>, <InlineCode>EMAIL</InlineCode>, and{' '}
						<InlineCode>AUTH_HASHER</InlineCode> live in <InlineCode>wrangler.jsonc</InlineCode>.
					</>
				}
			>
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

				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					Commands use Bun. Under npm, put <InlineCode>--</InlineCode> before script flags (
					<InlineCode>npm run branch-env -- --yes</InlineCode>); Bun, Nub, pnpm, yarn, and aube
					forward arguments directly. Switch managers with{' '}
					<InlineCode>bun run install-deps --pm &lt;manager&gt;</InlineCode>.
				</p>
			</PanelSection>

			<PanelSection
				id="checks"
				title="Checks"
				description="There is no product test suite yet. These gates are the check. Run them before you call a change done."
			>
				<PanelList>
					{checks.map((check) => (
						<PanelRow key={check.name} label={check.name}>
							{check.description}
						</PanelRow>
					))}
				</PanelList>

				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					<InlineCode>bun run validate-setup</InlineCode> is the health check for env, ports, and
					the database. Warnings are not failures.
				</p>
			</PanelSection>

			<PanelSection
				id="toolchain"
				title="Toolchain"
				description="Some setup is automatic. These are the moving parts that can surprise you."
			>
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

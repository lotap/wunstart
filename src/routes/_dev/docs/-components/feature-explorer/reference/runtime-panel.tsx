import {CodeBlock} from '../../code-block.tsx'
import {PanelReferences} from '../../doc-links.tsx'
import {DocBulletList, InlineCode, PanelHeader, PanelSection, Prose} from '../../doc-ui.tsx'

/** Worker entry shown in the runtime reference. */
const workerEntry = `export {AuthHasher} from './durable-objects/auth-hasher.ts'

export default {
	fetch: handler.fetch,
	scheduled,
}`

/** Cloudflare bindings used by the app. */
const bindings = [
	{
		name: 'HYPERDRIVE',
		description:
			'Postgres connection pool in production. Local development uses DATABASE_URL directly.',
	},
	{
		name: 'EMAIL',
		description: 'Cloudflare send_email binding. The dev transport uses Mailpit instead.',
	},
	{
		name: 'AUTH_HASHER',
		description: 'Durable Object binding for Argon2id password hashing.',
	},
]

/** Why password hashing runs outside the request Worker. */
const hashingFacts = [
	'Workers allows 10 ms of CPU per request on the free plan; Argon2id needs about 700 ms at the current parameters.',
	'The AuthHasher Durable Object has a 30 s budget, so one hash costs about 2% of it.',
	'Per-user sharding: idFromName(userId) isolates users and acts as an implicit rate limit.',
	'Parameters live in _hashing.ts: m=65536, t=3, p=1, dkLen=32. A login rehashes when the stored parameters lag.',
]

export function RuntimePanel() {
	return (
		<>
			<PanelHeader
				title="Runtime & hashing"
				description="The Worker entry, its bindings, and the Durable Object that keeps password hashing off the request CPU budget."
			/>

			<PanelSection id="worker-entry" title="Worker entry">
				<Prose>
					<InlineCode>src/server.ts</InlineCode> is the Wrangler entry point. It re-exports the
					hasher Durable Object and exports the Start fetch handler plus a scheduled cron. The daily
					job runs at 06:30 UTC and archives activities older than 30 days.
				</Prose>
				<CodeBlock code={workerEntry} label="src/server.ts" language="typescript" />

				<Prose>
					<InlineCode>bun run archive-old-activities</InlineCode> is the same archival path for a
					VPS cron. It reads an exported <InlineCode>DATABASE_URL</InlineCode> first, then{' '}
					<InlineCode>.env.local</InlineCode>, then <InlineCode>.env</InlineCode>, because
					production may have no env files.
				</Prose>
			</PanelSection>

			<PanelSection id="runtime-bindings" title="Bindings and secrets">
				<Prose>
					Bindings come from <InlineCode>wrangler.jsonc</InlineCode>. Run{' '}
					<InlineCode>bun run cf-typegen</InlineCode> after any binding change.
				</Prose>
				<dl className="grid gap-4 sm:grid-cols-3">
					{bindings.map((binding) => (
						<div key={binding.name} className="flex flex-col gap-1 border-t pt-3">
							<dt>
								<code className="font-mono text-sm text-foreground">{binding.name}</code>
							</dt>
							<dd className="text-sm leading-relaxed text-muted-foreground">
								{binding.description}
							</dd>
						</div>
					))}
				</dl>

				<Prose>
					The four token secret sets are required in development:{' '}
					<InlineCode>ACCESS_TOKEN_SECRETS</InlineCode>, <InlineCode>ANON_TOKEN_SECRETS</InlineCode>
					, <InlineCode>REFRESH_TOKEN_SECRETS</InlineCode>, and{' '}
					<InlineCode>REFRESH_GRACE_TOKEN_SECRETS</InlineCode>. Provision the same values in
					production with <InlineCode>wrangler secret put</InlineCode>.
				</Prose>
			</PanelSection>

			<PanelSection id="app-factory" title="App factory">
				<Prose>
					<InlineCode>src/start.ts</InlineCode> builds the Start instance with request and function
					middleware. <InlineCode>src/router.tsx</InlineCode> creates the router and wires it to
					TanStack Query, route errors, scroll restoration, preloading, and view transitions. The
					Start plugin emits <InlineCode>routeTree.gen.ts</InlineCode>; never hand-edit it.
				</Prose>
			</PanelSection>

			<PanelSection id="password-hashing" title="Password hashing">
				<Prose>
					Password hashing runs in <InlineCode>AuthHasher</InlineCode>, not in the request Worker.
					The op asks for a stub, and the layer addresses the user or Anon shard.
				</Prose>
				<DocBulletList>
					{hashingFacts.map((fact) => (
						<li key={fact}>{fact}</li>
					))}
				</DocBulletList>
			</PanelSection>

			<PanelSection id="wasm-kernel" title="Wasm kernel">
				<Prose>
					<InlineCode>src/durable-objects/argon2-do-hasher.wasm</InlineCode> is committed. Dev,
					build, and deploy never need Rust. Rebuild it only after editing{' '}
					<InlineCode>crates/</InlineCode>, with <InlineCode>bun run build:wasm</InlineCode>, and
					commit the rebuilt kernel with the source change. The pre-commit hook blocks a{' '}
					<InlineCode>crates/</InlineCode> change without a staged wasm file. Never hand-edit the
					kernel.
				</Prose>
			</PanelSection>

			<PanelSection id="effect-services" title="Effect services">
				<Prose>
					Services are <InlineCode>Context.Service</InlineCode> tags; layers are provided per run by{' '}
					<InlineCode>runOp</InlineCode> or by the middleware.{' '}
					<InlineCode>cloudflare:workers</InlineCode> is imported lazily so modules stay importable
					outside the Workers runtime. Ops never construct infrastructure; the call site supplies
					the layer.
				</Prose>
			</PanelSection>

			<PanelReferences
				links={[
					{
						label: 'Cloudflare Durable Objects',
						href: 'https://developers.cloudflare.com/durable-objects/',
					},
					{
						label: 'Workers limits',
						href: 'https://developers.cloudflare.com/workers/platform/limits/',
					},
					{
						label: 'Cron Triggers',
						href: 'https://developers.cloudflare.com/workers/configuration/cron-triggers/',
					},
					{
						label: 'Wrangler secrets',
						href: 'https://developers.cloudflare.com/workers/configuration/secrets/',
					},
					{label: 'RFC 9106: Argon2', href: 'https://www.rfc-editor.org/rfc/rfc9106'},
				]}
			/>
		</>
	)
}

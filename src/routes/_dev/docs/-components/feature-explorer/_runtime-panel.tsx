import {bindings, hashingFacts, workerEntry} from '../../-content/runtime.ts'
import {CodeBlock} from '../code-block.tsx'
import {PanelReferences} from '../doc-links.tsx'
import {DocBulletList, InlineCode, PanelHeader, PanelSection} from '../doc-ui.tsx'

export function RuntimePanel() {
	return (
		<>
			<PanelHeader
				title="Runtime & hashing"
				description="The Worker entry, its bindings, and the Durable Object that keeps password hashing off the request CPU budget."
			/>

			<PanelSection
				id="worker-entry"
				title="Worker entry"
				description={
					<>
						<InlineCode>src/server.ts</InlineCode> is the Wrangler entry point. It re-exports the
						hasher Durable Object and exports the Start fetch handler plus a scheduled cron. The
						daily job runs at 06:30 UTC and archives activities older than 30 days.
					</>
				}
			>
				<CodeBlock code={workerEntry} label="src/server.ts" language="typescript" />

				<p className="mt-3 text-sm leading-relaxed text-muted-foreground">
					<InlineCode>bun run archive-old-activities</InlineCode> is the same archival path for a
					VPS cron. It reads an exported <InlineCode>DATABASE_URL</InlineCode> first, then{' '}
					<InlineCode>.env.local</InlineCode>, then <InlineCode>.env</InlineCode>, because
					production may have no env files.
				</p>
			</PanelSection>

			<PanelSection
				id="runtime-bindings"
				title="Bindings and secrets"
				description={
					<>
						Bindings come from <InlineCode>wrangler.jsonc</InlineCode>. Run{' '}
						<InlineCode>bun run cf-typegen</InlineCode> after any binding change.
					</>
				}
			>
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

				<p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
					The four token secret sets are required in development:{' '}
					<InlineCode>ACCESS_TOKEN_SECRETS</InlineCode>, <InlineCode>ANON_TOKEN_SECRETS</InlineCode>
					, <InlineCode>REFRESH_TOKEN_SECRETS</InlineCode>, and{' '}
					<InlineCode>REFRESH_GRACE_TOKEN_SECRETS</InlineCode>. Provision the same values in
					production with <InlineCode>wrangler secret put</InlineCode>.
				</p>
			</PanelSection>

			<PanelSection
				id="app-factory"
				title="App factory"
				description={
					<>
						<InlineCode>src/start.ts</InlineCode> builds the Start instance with request and
						function middleware. <InlineCode>src/router.tsx</InlineCode> creates the router and
						wires it to TanStack Query, route errors, scroll restoration, preloading, and view
						transitions. The Start plugin emits <InlineCode>routeTree.gen.ts</InlineCode>; never
						hand-edit it.
					</>
				}
			/>

			<PanelSection
				id="password-hashing"
				title="Password hashing"
				description={
					<>
						Password hashing runs in <InlineCode>AuthHasher</InlineCode>, not in the request Worker.
						The op asks for a stub, and the layer addresses the user or Anon shard.
					</>
				}
			>
				<DocBulletList>
					{hashingFacts.map((fact) => (
						<li key={fact}>{fact}</li>
					))}
				</DocBulletList>
			</PanelSection>

			<PanelSection
				id="wasm-kernel"
				title="Wasm kernel"
				description={
					<>
						<InlineCode>src/durable-objects/argon2-do-hasher.wasm</InlineCode> is committed. Dev,
						build, and deploy never need Rust. Rebuild it only after editing{' '}
						<InlineCode>crates/</InlineCode>, with <InlineCode>bun run build:wasm</InlineCode>, and
						commit the rebuilt kernel with the source change. The pre-commit hook blocks a{' '}
						<InlineCode>crates/</InlineCode> change without a staged wasm file. Never hand-edit the
						kernel.
					</>
				}
			/>

			<PanelSection
				id="effect-services"
				title="Effect services"
				description={
					<>
						Services are <InlineCode>Context.Service</InlineCode> tags; layers are provided per run
						by <InlineCode>runOp</InlineCode> or by the middleware.{' '}
						<InlineCode>cloudflare:workers</InlineCode> is imported lazily so modules stay
						importable outside the Workers runtime. Ops never construct infrastructure; the call
						site supplies the layer.
					</>
				}
			/>

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

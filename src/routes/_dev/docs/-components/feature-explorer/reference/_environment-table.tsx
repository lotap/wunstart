import {InlineCode, PanelTableHeader} from '../../doc-ui.tsx'

/** Environment variables grouped by the part of the app that reads them. */
const environmentGroups: Array<{
	name: string
	variables: Array<{name: string; description: React.ReactNode}>
}> = [
	{
		name: 'App runtime',
		variables: [
			{
				name: 'DATABASE_URL',
				description: (
					<>
						Required. Postgres connection string. <InlineCode>branch-env</InlineCode> writes the
						branch database URL to <InlineCode>.env.local</InlineCode>; trunk uses the committed
						URL.
					</>
				),
			},
			{
				name: 'VITE_COOKIE_DOMAIN',
				description: (
					<>
						Required. Domain for the auth and anon cookies. <InlineCode>localhost</InlineCode> in
						development.
					</>
				),
			},
			{
				name: 'CLOUDFLARE_ENV',
				description: (
					<>
						Selects the Wrangler environment. Development uses <InlineCode>development</InlineCode>.
					</>
				),
			},
			{
				name: 'CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE',
				description: (
					<>
						Required locally. Points the <InlineCode>HYPERDRIVE</InlineCode> binding at the local
						Postgres URL.
					</>
				),
			},
		],
	},
	{
		name: 'Auth',
		variables: [
			{
				name: 'ACCESS_TOKEN_SECRETS',
				description: (
					<>
						Required. Rotatable <InlineCode>id:secret</InlineCode> pairs for access tokens. New
						tokens use the first pair.
					</>
				),
			},
			{
				name: 'ANON_TOKEN_SECRETS',
				description: (
					<>
						Required. Rotatable <InlineCode>id:secret</InlineCode> pairs for anonymous identity
						tokens.
					</>
				),
			},
			{
				name: 'REFRESH_TOKEN_SECRETS',
				description: (
					<>
						Required. Rotatable <InlineCode>id:secret</InlineCode> pairs for refresh tokens.
					</>
				),
			},
			{
				name: 'REFRESH_GRACE_TOKEN_SECRETS',
				description: (
					<>Required. Separate pairs for the short-lived refresh grace token used during retries.</>
				),
			},
		],
	},
	{
		name: 'Email',
		variables: [
			{
				name: 'MAILPIT_URL',
				description: (
					<>
						Mailpit HTTP URL for the dev transport and inbox links.{' '}
						<InlineCode>branch-env</InlineCode> writes the resolved URL to{' '}
						<InlineCode>.env.local</InlineCode>; the compose default is{' '}
						<InlineCode>http://localhost:8025</InlineCode>.
					</>
				),
			},
			{
				name: 'EMAIL_TRANSPORT',
				description: (
					<>
						Primary transport: <InlineCode>mailpit</InlineCode> (dev only),{' '}
						<InlineCode>sendemail</InlineCode>, or <InlineCode>brevo</InlineCode>. Defaults to{' '}
						<InlineCode>mailpit</InlineCode> in development and <InlineCode>sendemail</InlineCode>{' '}
						in production.
					</>
				),
			},
			{
				name: 'EMAIL_FALLBACK',
				description: (
					<>
						Comma-separated fallback transports (<InlineCode>sendemail</InlineCode>,{' '}
						<InlineCode>brevo</InlineCode>). Defaults to <InlineCode>brevo</InlineCode> in
						production and empty in development.
					</>
				),
			},
			{
				name: 'EMAIL_FROM',
				description: (
					<>
						Sender address for outgoing mail. Defaults to{' '}
						<InlineCode>noreply@wunstart.com</InlineCode>; override it for your domain.
					</>
				),
			},
			{
				name: 'APP_URL',
				description: (
					<>
						App URL exposed to the email service. Defaults to{' '}
						<InlineCode>http://localhost:3000</InlineCode>; set your public URL in production.
					</>
				),
			},
			{
				name: 'BREVO_API_KEY',
				description: (
					<>
						Brevo API key. Required only when <InlineCode>brevo</InlineCode> is used.
					</>
				),
			},
		],
	},
	{
		name: 'Local tooling',
		variables: [
			{
				name: 'DEV_PORT',
				description: (
					<>
						Human dev server port. Defaults to <InlineCode>3000</InlineCode>; written by{' '}
						<InlineCode>branch-env</InlineCode>.
					</>
				),
			},
			{
				name: 'AGENT_DEV_PORT',
				description: (
					<>
						Shared agent server port in <InlineCode>3100–3199</InlineCode>; written by{' '}
						<InlineCode>branch-env</InlineCode>.
					</>
				),
			},
			{
				name: 'AGENT_DEV_IDLE_MS',
				description: (
					<>
						Agent server idle timeout. Defaults to <InlineCode>900000</InlineCode> (15 minutes).
					</>
				),
			},
			{
				name: 'AGENT_DEV_MAX_SERVERS',
				description: (
					<>
						Maximum agent servers per worktree. Defaults to <InlineCode>4</InlineCode>.
					</>
				),
			},
			{
				name: 'POSTGRES_PORT',
				description: (
					<>
						Docker Compose host port for Postgres. Defaults to <InlineCode>5432</InlineCode>.
					</>
				),
			},
			{
				name: 'MAILPIT_SMTP_PORT',
				description: (
					<>
						Docker Compose host port for Mailpit SMTP. Defaults to <InlineCode>1025</InlineCode>.
					</>
				),
			},
			{
				name: 'MAILPIT_HTTP_PORT',
				description: (
					<>
						Docker Compose host port for Mailpit HTTP. Defaults to <InlineCode>8025</InlineCode>.
					</>
				),
			},
		],
	},
]

/** Add break opportunities after underscores so long names wrap in the table. */
function EnvironmentVariableName({name}: {name: string}) {
	const segments = name.split('_')

	return (
		<code className="font-mono text-sm text-foreground">
			{segments.map((segment, index) => (
				// oxlint-disable-next-line react/no-array-index-key react-doctor/no-array-index-as-key -- segments are positional
				<span key={index}>
					{segment}
					{index < segments.length - 1 && (
						<>
							_<wbr />
						</>
					)}
				</span>
			))}
		</code>
	)
}

export function EnvironmentTable() {
	return (
		<div className="overflow-hidden rounded-xl border">
			<table className="w-full table-fixed text-left">
				<caption className="sr-only">Environment variables</caption>
				<thead>
					<tr className="border-b">
						<PanelTableHeader scope="col" className="w-2/5 px-5 py-4">
							Variable
						</PanelTableHeader>
						<PanelTableHeader scope="col" className="px-5 py-4">
							Used for
						</PanelTableHeader>
					</tr>
				</thead>
				{environmentGroups.map((group) => (
					<tbody key={group.name}>
						<tr className="border-t">
							<PanelTableHeader colSpan={2} scope="colgroup" className="px-5 py-3">
								{group.name}
							</PanelTableHeader>
						</tr>
						{group.variables.map((envVar) => (
							<tr key={envVar.name} className="border-t align-top">
								<th scope="row" className="px-5 py-4 text-left font-normal">
									<EnvironmentVariableName name={envVar.name} />
								</th>
								<td className="px-5 py-4 text-base leading-relaxed text-muted-foreground">
									{envVar.description}
								</td>
							</tr>
						))}
					</tbody>
				))}
			</table>
		</div>
	)
}

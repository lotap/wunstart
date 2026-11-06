import {InlineCode} from '../-components/doc-ui.tsx'

/** One-time and per-checkout setup commands. */
export const setupCommands = [
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
export const checks = [
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
export const toolchainNotes = [
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

/** Environment variables grouped by the part of the app that reads them. */
export const environmentGroups: Array<{
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

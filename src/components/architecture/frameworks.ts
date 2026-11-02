export type Framework = {
	name: string
	slug: string
	role: string
	description: string
	docs: string
	where: string
	areas: Array<string>
	skills: Array<string>
	groupIndexes: Array<number>
}

export const frameworks: Array<Framework> = [
	{
		name: 'React',
		slug: 'react',
		docs: 'https://react.dev/',
		role: 'Renderer',
		description:
			'React 19 renders the app on the server and in the browser. React Compiler is on, so components skip manual useMemo, useCallback, and React.memo. TanStack Start supplies SSR and the route tree.',
		where: 'src/routes · src/components',
		areas: ['src/components', 'src/routes'],
		skills: ['improve-react', 'wunstart'],
		groupIndexes: [0],
	},
	{
		name: 'Tailwind',
		slug: 'tailwind',
		docs: 'https://tailwindcss.com/docs',
		role: 'Styling',
		description:
			'Tailwind v4 provides the utilities and theme tokens behind every screen. wunstart keeps the scales in src/styles.css and composes classes with cn(), so spacing, color, and radius stay consistent.',
		where: 'src/styles.css · src/components/ui',
		areas: ['src/styles.css', 'src/components/ui'],
		skills: ['wunstart'],
		groupIndexes: [0],
	},
	{
		name: 'shadcn/ui',
		slug: 'shadcn',
		docs: 'https://ui.shadcn.com/docs',
		role: 'UI primitives',
		description:
			'The generated Base UI components in src/components/ui supply buttons, cards, fields, drawers, toasts, and navigation. wunstart leaves them unedited and overrides from the caller with cn(), so every page shares one token system.',
		where: 'src/components/ui · src/styles.css',
		areas: ['src/components/ui', 'src/styles.css'],
		skills: ['shadcn', 'wunstart'],
		groupIndexes: [0],
	},
	{
		name: 'TanStack Start',
		slug: 'tanstack-start',
		docs: 'https://tanstack.com/start/latest/docs/framework/react/overview',
		role: 'App framework',
		description:
			'TanStack Start owns file-based routing, SSR, and the typed server-function boundary. wunstart uses route groups for access placement and server functions as the only entry point into runOp.',
		where: 'src/routes · src/server-fns · src/start.ts',
		areas: ['src/routes', 'src/server-fns', 'src/start.ts'],
		skills: ['wunstart'],
		groupIndexes: [0, 1],
	},
	{
		name: 'Effect',
		slug: 'effect',
		docs: 'https://effect.website/docs',
		role: 'Runtime',
		description:
			'Every wunshot op is an Effect program with typed failures, services, retries, and spans. runOp provides the database, email, and hashing layers at the edge, so domain code never constructs infrastructure.',
		where: 'src/db/ops · src/middleware/_run-op.server.ts',
		areas: ['src/db/ops', 'src/middleware/_run-op.server.ts'],
		skills: ['effect', 'wunshot'],
		groupIndexes: [1],
	},
	{
		name: 'Effect Schema',
		slug: 'effect-schema',
		docs: 'https://effect.website/docs/schema/introduction',
		role: 'Validation',
		description:
			'Effect Schema validates forms, server-function input, and database rows. wunshot derives insert and select schemas from Drizzle tables, and the same shapes feed TanStack Form and the server boundary.',
		where: 'src/isomorphic · src/db/models',
		areas: ['src/isomorphic', 'src/db/models'],
		skills: ['effect', 'wunshot'],
		groupIndexes: [1],
	},
	{
		name: 'Drizzle',
		slug: 'drizzle',
		docs: 'https://orm.drizzle.team/docs/overview',
		role: 'ORM + migrations',
		description:
			'Drizzle defines tables and prepared queries. wunshot builds tables through factories, pairs live and archive tables, and generates migrations with Drizzle Kit. Queries stay prepared and typed.',
		where: 'src/db · drizzle.config.ts',
		areas: ['src/db', 'drizzle.config.ts'],
		skills: ['wunshot'],
		groupIndexes: [1],
	},
	{
		name: 'Postgres',
		slug: 'postgres',
		docs: 'https://www.postgresql.org/docs/',
		role: 'Database',
		description:
			'Postgres is the source of truth. Local development runs it in Docker; production reaches it through Cloudflare Hyperdrive or a direct DATABASE_URL. Foreign keys, transactions, and database now() carry the guarantees.',
		where: 'compose.yaml · wrangler.jsonc',
		areas: ['compose.yaml', 'wrangler.jsonc'],
		skills: ['wunshot'],
		groupIndexes: [1],
	},
	{
		name: 'oxlint',
		slug: 'oxlint',
		docs: 'https://oxc.rs/docs/guide/usage/linter.html',
		role: 'Linter',
		description:
			'oxlint runs the project’s custom wunstart and wunshot rules, anti-slop, and React Doctor in one fast pass. It guards the seams around ops, tables, middleware, and React code.',
		where: 'oxlint.config.ts · tools/linters',
		areas: ['tools/linters', 'oxlint.config.ts'],
		skills: ['wunstart', 'install-anti-slop'],
		groupIndexes: [2],
	},
	{
		name: 'anti-slop',
		slug: 'anti-slop',
		docs: 'https://github.com/dmmulroy/anti-slop',
		role: 'Lint rules',
		description:
			'anti-slop is the vendored rule set inside oxlint that catches generic copy, filler patterns, and slop in UI code. It is editable source in the repo, not an npm dependency.',
		where: 'tools/linters/anti-slop · oxlint.config.ts',
		areas: ['tools/linters/anti-slop', 'oxlint.config.ts'],
		skills: ['install-anti-slop'],
		groupIndexes: [2],
	},
	{
		name: 'React Doctor',
		slug: 'react-doctor',
		docs: 'https://www.react.doctor/docs',
		role: 'React audit',
		description:
			'React Doctor audits React code for hooks, rendering, and performance anti-patterns. Its rules are merged into oxlint; a separate scanner runs at latest.',
		where: 'doctor.config.json · oxlint.config.ts',
		areas: ['doctor.config.json', 'oxlint.config.ts'],
		skills: ['improve-react'],
		groupIndexes: [2],
	},
	{
		name: 'Durable Objects',
		slug: 'durable-objects',
		docs: 'https://developers.cloudflare.com/durable-objects/',
		role: 'Stateful runtime',
		description:
			'Cloudflare Durable Objects run the Argon2 auth hasher. A user or Anon id addresses each hasher instance, so hashing runs at the edge without keeping secrets in the Worker.',
		where: 'src/durable-objects · wrangler.jsonc',
		areas: ['src/durable-objects', 'wrangler.jsonc'],
		skills: ['wunstart', 'workers-best-practices', 'cloudflare'],
		groupIndexes: [3],
	},
	{
		name: 'Hyperdrive',
		slug: 'hyperdrive',
		docs: 'https://developers.cloudflare.com/hyperdrive/',
		role: 'Database proxy',
		description:
			'Cloudflare Hyperdrive pools and accelerates Postgres connections in production. Local development uses DATABASE_URL directly, so the app can run with or without it.',
		where: 'wrangler.jsonc · src/db/index.ts',
		areas: ['src/db/index.ts', 'wrangler.jsonc'],
		skills: ['cloudflare', 'wrangler'],
		groupIndexes: [3],
	},
	{
		name: 'Alchemy',
		slug: 'alchemy',
		docs: 'https://alchemy.run/getting-started/',
		role: 'Coming in a future version',
		description:
			'Alchemy will provision and manage the Cloudflare resources from code. It is not wired yet; the current setup uses Wrangler and the repo config.',
		where: 'future version',
		areas: [],
		skills: [],
		groupIndexes: [3],
	},
]

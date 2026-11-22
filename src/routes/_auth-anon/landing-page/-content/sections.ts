/** The primitives every feature is built from. */
export const primitiveSteps = [
	{label: 'Route', description: 'Page or server function'},
	{label: 'Op', description: 'Business logic'},
	{label: 'Model', description: 'Table and queries'},
]

/** Principles shown below the primitive steps. */
export const primitiveCards = [
	{
		title: 'Conventions, not vibes',
		description:
			'A feature is a model, an op, and a route. Agents do not invent a new architecture for each request.',
	},
	{
		title: 'Rot-resistant',
		description:
			'Typed failures, archive twins, and lint rules catch drift while it is still small.',
	},
	{
		title: 'Independent by default',
		description:
			'Each feature owns its slice. Add or remove one without untangling the rest of the app.',
	},
]

/** Replaceable layers in the portability section. */
export const portabilityLayers = [
	{
		name: 'Hosting',
		default: 'Cloudflare Workers.',
		alternative: 'TanStack Start also runs on Node.',
	},
	{
		name: 'Database',
		default: 'Postgres through Drizzle.',
		alternative: 'Point DATABASE_URL at any Postgres.',
	},
	{
		name: 'Hashing',
		default: 'Argon2id in a Cloudflare Durable Object.',
		alternative: 'Swap the hasher behind the same interface.',
	},
	{
		name: 'Email',
		default: 'Mailpit locally.',
		alternative: 'Bring any production transport.',
	},
	{
		name: 'UI',
		default: 'Tailwind and shadcn/ui.',
		alternative: 'Override from the caller or replace the components.',
	},
]

/** Default stack listed in the portability card. */
export const defaultPath = [
	'TanStack Start on Workers',
	'Postgres + Drizzle',
	'Effect ops with typed failures',
	'Argon2id in a Durable Object',
	'Mailpit for local email',
]

/** Worker entry shown in the runtime reference. */
export const workerEntry = `export {AuthHasher} from './durable-objects/auth-hasher.ts'

export default {
	fetch: handler.fetch,
	scheduled,
}`

/** Cloudflare bindings used by the app. */
export const bindings = [
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
export const hashingFacts = [
	'Workers allows 10 ms of CPU per request on the free plan; Argon2id needs about 700 ms at the current parameters.',
	'The AuthHasher Durable Object has a 30 s budget, so one hash costs about 2% of it.',
	'Per-user sharding: idFromName(userId) isolates users and acts as an implicit rate limit.',
	'Parameters live in _hashing.ts: m=65536, t=3, p=1, dkLen=32. A login rehashes when the stored parameters lag.',
]

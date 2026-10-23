import {PgClient} from '@effect/sql-pg'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import {Config, Context, Effect, Layer, Option, Redacted, Schema} from 'effect'

/** Layer-build failure: no `DATABASE_URL` and the Workers runtime/binding is unavailable */
class DbConfigError extends Schema.TaggedError<DbConfigError, {readonly brand: unique symbol}>()(
	'DbConfigError',
	{
		message: Schema.String,
		cause: Schema.Unknown,
	},
) {}

/**
 * Resolve the Postgres connection string at layer-build time:
 * 1. `DATABASE_URL` from the environment (Node/VPS, standalone scripts, local tooling)
 * 2. The Hyperdrive binding (Cloudflare runtime only)
 *
 * The `cloudflare:workers` import must stay lazy. The module only exists inside the
 * Workers runtime, so it's never loaded when `DATABASE_URL` is set (e.g. on a VPS).
 */
const connectionString = Effect.gen(function* () {
	const fromEnvironment = yield* Config.option(Config.Redacted('DATABASE_URL'))

	if (Option.isSome(fromEnvironment)) return fromEnvironment.value

	const {env} = yield* Effect.tryPromise({
		try: () => import('cloudflare:workers'),
		catch: (cause: unknown) =>
			new DbConfigError({
				message:
					'DATABASE_URL is not set and cloudflare:workers is unavailable. Set DATABASE_URL or run inside the Workers runtime.',
				cause,
			}),
	})

	return Redacted.make(env.HYPERDRIVE.connectionString)
})

/**
 * The client layer builds the driver's pool structure but opens no socket
 * until the first query (`@effect/sql-pg` runs no eager probe). This lets
 * JWT-only paths (anon verify) inject `dbLayer` without touching Postgres
 * unless a failure actually needs recording. Connect errors surface on the
 * first query.
 */
const pgClientLayer = Layer.unwrap(
	connectionString.pipe(
		Effect.map((url) =>
			// `unstableApiUsage` warns that PgClient.layer may change in any release.
			// It is the only Postgres driver layer the pinned package exposes, and this
			// module is its sole consumer, so an upstream change breaks the typecheck
			// here instead of across the app.
			// @effect-diagnostics-next-line unstableApiUsage:off
			PgClient.layer({
				url,
				connectTimeout: 5_000,
			}),
		),
	),
)

// Create the DB effect with default services
const drizzleEffect = PgDrizzle.makeWithDefaults()

// Define a DB service tag for dependency injection
export class DB extends Context.Service<DB, Effect.Success<typeof drizzleEffect>>()('DB') {}

// Create a layer that provides the DB service
const drizzleLayer = Layer.effect(DB, drizzleEffect)

// Compose layers together
//
// The application's dependency graph is supplied per-op: callers pass only the layers a
// given op needs (see `runOp` in `_run-op.server.ts`), and the graph is built and torn
// down inside the scope of the run that uses it. Cloudflare Workers request contexts
// forbid long-lived state (pools/sockets) created in one request being reused in another.
export const dbLayer = drizzleLayer.pipe(Layer.provide(pgClientLayer))

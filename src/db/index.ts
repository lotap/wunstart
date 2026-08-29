import {PgClient} from '@effect/sql-pg'
import * as PgDrizzle from 'drizzle-orm/effect-postgres'
import {Config, Context, Effect, Layer, Option, Redacted, Schema} from 'effect'
import {Pool as PgPool, types} from 'pg'

/** Layer-build failure: no `DATABASE_URL` and the Workers runtime/binding is unavailable */
class DbConfigError extends Schema.TaggedErrorClass<DbConfigError>()('DbConfigError', {
	message: Schema.String,
	cause: Schema.Unknown,
}) {}

/**
 * Resolve the Postgres connection string at layer-build time:
 * 1. `DATABASE_URL` from the environment (Node/VPS, standalone scripts, local tooling)
 * 2. The Hyperdrive binding (Cloudflare runtime only)
 *
 * The `cloudflare:workers` import must stay lazy. The module only exists inside the
 * Workers runtime, so it's never loaded when `DATABASE_URL` is set (e.g. on a VPS).
 */
const connectionString = Effect.gen(function* () {
	const fromEnvironment = yield* Config.option(Config.redacted('DATABASE_URL'))
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

// Date/time type parsers passed to pg so Drizzle can parse them itself
const customTypes = {
	// `format` is `'text' | 'binary'` per pg's own getTypeParser signature
	getTypeParser: (typeId: number, format: 'text' | 'binary' | undefined = 'text') => {
		// Return raw values for date/time types to let Drizzle handle parsing
		// from: https://orm.drizzle.team/docs/connect-effect-postgres#step-2---initialize-the-driver-and-make-a-query
		if ([1184, 1114, 1082, 1186, 1231, 1115, 1185, 1187, 1182].includes(typeId)) {
			// The parameter must be `any`: pg's `TypeParser` types the callback as `(oid: number) =>
			// TReturn`, which no narrower parameter signature is assignable to (contravariance). This
			// mirrors Drizzle's own driver implementations (see neon-serverless session).
			return (val: any) => val
		}
		return types.getTypeParser(typeId, format)
	},
}

/**
 * The pg pool is built from a connection string, but the pool itself is lazy.
 * It opens no socket until the first query. Unlike `PgClient.layerConfig` (which
 * runs an eager `SELECT 1` probe when the layer is built), `fromPool` only
 * acquires the pool object, so building `dbLayer` never connects. This lets
 * JWT-only paths (anon verify) inject `dbLayer` without touching Postgres unless
 * a failure actually needs recording. Connect errors surface on the first query.
 */
const pgClientLayer = PgClient.layerFrom(
	connectionString.pipe(
		Effect.flatMap((url) =>
			PgClient.fromPool({
				acquire: Effect.acquireRelease(
					Effect.sync(() => {
						const pool = new PgPool({
							connectionString: Redacted.value(url),
							connectionTimeoutMillis: 5_000,
							types: customTypes,
						})
						// Absorb idle-client errors; query-level failures surface otherwise
						pool.on('error', () => {})
						return pool
					}),
					(pool) =>
						Effect.tryPromise(() => pool.end()).pipe(
							Effect.ignore({
								log: true,
								message: 'Failed to close database pool cleanly',
							}),
						),
				),
			}),
		),
	),
)

// Create the DB effect with default services
const drizzleEffect = PgDrizzle.makeWithDefaults().pipe(Effect.provide(PgDrizzle.DefaultServices))

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

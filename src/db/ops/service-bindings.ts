import type {env} from 'cloudflare:workers'
import {Context, Effect, Layer, Schema} from 'effect'

/** Layer-build failure: the Workers runtime or the `AUTH_HASHER` binding is unavailable */
class HashingBindingError extends Schema.TaggedErrorClass<HashingBindingError>()(
	'HashingBindingError',
	{message: Schema.String, cause: Schema.Unknown},
) {}

export class HashingStub extends Context.Service<
	HashingStub,
	ReturnType<NonNullable<typeof env.AUTH_HASHER>['get']>
>()('HashingStub') {
	/**
	 * Layer scoped to a single hasher instance so the Wasm kernel is loaded once per identity.
	 *
	 * The `cloudflare:workers` import must stay lazy. The module only exists inside the
	 * Workers runtime, so this module stays importable (and type-only) everywhere else.
	 *
	 * Pass the authenticated `userId` where available, falling back to the anon id
	 */
	static layer(name: string) {
		return Layer.effect(
			HashingStub,
			// The binding lookup stays inside tryPromise so a missing AUTH_HASHER
			// binding surfaces as HashingBindingError, not a raw TypeError defect
			Effect.tryPromise({
				try: async () => {
					const {env} = await import('cloudflare:workers')
					return env.AUTH_HASHER.get(env.AUTH_HASHER.idFromName(name))
				},
				catch: (cause: unknown) =>
					new HashingBindingError({
						message:
							'cloudflare:workers is unavailable or the AUTH_HASHER binding is missing. Run inside the Workers runtime.',
						cause,
					}),
			}),
		)
	}
}

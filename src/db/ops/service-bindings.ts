import type {env} from 'cloudflare:workers'
import {Context, Effect, Layer, Schema} from 'effect'

/** Layer-build failure: the Workers runtime or the `AUTH_HASHER` binding is unavailable */
class HashingBindingError extends Schema.TaggedError<
	HashingBindingError,
	{readonly brand: unique symbol}
>()('HashingBindingError', {
	message: Schema.String,
	cause: Schema.Defect(),
}) {}

const bindingError = (cause: unknown) =>
	new HashingBindingError({
		message:
			'cloudflare:workers is unavailable or the AUTH_HASHER binding is missing. Run inside the Workers runtime.',
		cause,
	})

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
	 * Pass the authenticated `userId` where available, falling back to the anon id.
	 * `strict-effect-provide` warns that a layer provided below an entry point can
	 * outlive the scope that uses it. This layer is created and released inside the
	 * op that needs it, so it cannot outlive that scope; call sites disable the
	 * warning locally.
	 */
	static layer(name: string) {
		return Layer.effect(
			HashingStub,
			Effect.gen(function* () {
				// The lazy import and the binding lookup each have their own typed error handler,
				// so a missing AUTH_HASHER surfaces as HashingBindingError, not a defect
				const {env} = yield* Effect.tryPromise({
					try: () => import('cloudflare:workers'),
					catch: bindingError,
				})

				return yield* Effect.try({
					try: () => env.AUTH_HASHER.get(env.AUTH_HASHER.idFromName(name)),
					catch: bindingError,
				})
			}),
		)
	}
}

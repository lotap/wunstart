import {createServerOnlyFn} from '@tanstack/react-start'
import {Effect, Layer, Result, Schema} from 'effect'

import {RateLimitError} from '#/db/ops/rate-limit-error.ts'

import {allowPerWindow, addRateLimitEvent} from './rate-limit.ts'

/**
 * Ops have different Effect signatures (differing success/error/context types), so a single
 * wrapper type can't express them all. The generics below restore full inference at each
 * call site: op, args, and result are derived from the concrete op passed in.
 *
 * `L` is the caller-supplied tuple of layers (e.g. `[dbLayer, authLayer]`). It's constrained
 * to be non-empty, which is exactly what `Effect.provide` expects, so no cast is needed there.
 *
 * `T` is constrained to `Op<L>` so the call site fails to compile if `op` requires a service
 * the caller's layers don't provide.
 *
 * The op's params position is `never` rather than `any`. Any concrete op function is
 * assignable to `(params: never) => ...` by contravariance, while the success/error channels
 * are `unknown`. That leaves the requirement union `Layer.Success<L[number]>` as the only
 * part of the constraint that actually checks anything, which is exactly what the
 * layers-supply check needs.
 */
type Layers = [Layer.Any, ...Array<Layer.Any>]
type Op<L extends Layers> = (
	params: never,
) => Effect.Effect<unknown, unknown, Layer.Success<L[number]>>
/** Function-shaped constraint for `Parameters`/`ReturnType` extraction; every op satisfies it */
type OpFn = (params: never) => Effect.Effect<unknown, unknown, unknown>
type OpArgs<T extends OpFn> = Parameters<T>[0]
type OpResult<T extends OpFn> = Effect.Success<ReturnType<T>>

type RunArgs<L extends Layers, T extends Op<L>> = {
	op: T
	data: OpArgs<T>
	layers: L
}

const IpAddressParams = Schema.Struct({ipAddress: Schema.String})

/**
 * Reads the caller-supplied ipAddress for the rate limiter. Ops require `ipAddress` in
 * their params, enforced by `createOpsFn`; system ops get `0.0.0.0` injected by
 * `createSystemOpsFn`. But `runOp` receives opaque `OpArgs<T>`, so validate rather than
 * cast. A missing `ipAddress` is a programming error, and surfacing it as a thrown error
 * is intentional.
 */
function getOpIpAddress(data: {ipAddress?: unknown}): string | undefined {
	const parsed = Schema.decodeUnknownResult(IpAddressParams)(data)
	return Result.isSuccess(parsed) ? parsed.success.ipAddress : undefined
}

/**
 * Convenience function to reduce boilerplate in middleware & server fns
 *
 * - unwraps Effect result into plain value
 * - forwards RateLimitError failures to the middleware rate-limiter (throws a 429)
 * - any other failure rejects the promise (throws), so callers handle their own
 *   error classification, e.g. the auth middlewares decide the request's
 *   identity state inline (see `verify-auth.ts` / `verify-anon.ts`)
 * - wraps entire op in createServerOnlyFn to prevent client-side leakage
 *
 * @returns The op's success value; or rejects with the op's failure, or
 *          throws a 429 if the rate limiter threshold is breached
 */
export const runOp = createServerOnlyFn(
	async <T extends Op<L>, const L extends Layers>(args: RunArgs<L, T>): Promise<OpResult<T>> => {
		const {op, data, layers} = args
		const ip = getOpIpAddress(data)
		if (ip === undefined) throw new Error('runOp: op params must include a string ipAddress')

		const effect = Effect.provide(op(data), layers).pipe(
			Effect.catch((cause) => {
				if (Schema.is(RateLimitError)(cause))
					addRateLimitEvent({ipAddress: ip, weight: allowPerWindow(1)})

				return Effect.fail(cause)
			}),
		)

		// SAFETY: `L` covers every service `op` needs (enforced by `T extends Op<L>`);
		// TypeScript can't reduce `Exclude<Layer.Success<L[number]>, Layer.Success<L[number]>>`
		// when `L` is a generic tuple, so the fully-provided effect is re-contracted
		// to the caller's exact success type.
		return Effect.runPromise(effect as Effect.Effect<OpResult<T>, unknown>)
	},
)

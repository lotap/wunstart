import {Effect, Schedule, Schema} from 'effect'

import {HashingStub} from '#/db/ops/service-bindings.ts'

/**
 * Options based on https://www.rfc-editor.org/rfc/rfc9106.html#name-recommendations
 * cross-reference https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
 * & https://tobtu.com/minimum-password-settings/
 */
export const HASHING_CONFIG = {
	p: 1, // Parallel
	t: 3, // Time Cost
	m: 2 ** 16, // Memory Cost (64 MiB)
	dkLen: 32, // Hash length
}

/**
 * A syntactically valid Argon2id PHC string with no matching password.
 *
 * Verification parses the encoded cost parameters, recomputes the hash, and
 * compares, so pointing an unknown-user check at this string makes the Wasm do
 * the same work as a real password check while always returning a non-match.
 * The salt and digest are arbitrary; the digest is 32 bytes to match
 * `HASHING_CONFIG.dkLen`.
 *
 * The cost parameters are interpolated rather than copied so tuning
 * `HASHING_CONFIG` cannot silently make the dummy path cheaper than a real
 * verification and reopen the timing oracle this exists to close.
 */
export const DUMMY_ARGON2_HASH = `$argon2id$v=19$m=${HASHING_CONFIG.m},t=${HASHING_CONFIG.t},p=${HASHING_CONFIG.p}$c29tZXJhbmRvbXNhbHQxMg$RdescudvJCsgt3ub+b+dWRWJTmaaJObG+5+Hq+8v+5A`

export class HashingError extends Schema.TaggedError<
	HashingError,
	{readonly brand: unique symbol}
>()('HashingError', {
	operation: Schema.Literals(['hash', 'verify'] as const),
	cause: Schema.Defect(),
}) {}

/** Retry Durable Object RPC failures. Hashing is a pure function, so re-running is safe */
const retryHasher = <A>(effect: Effect.Effect<A, HashingError>): Effect.Effect<A, HashingError> =>
	effect.pipe(
		Effect.retry({
			times: 2,
			schedule: Schedule.exponential('50 millis', 2).pipe(Schedule.jittered),
		}),
	)

/** Transform given target into a hashed string using Argon2id */
export const hashTarget = Effect.fn('hashTarget')(function* (password: string) {
	const stub = yield* HashingStub

	return yield* Effect.tryPromise({
		try: () => stub.hashPassword(password, HASHING_CONFIG),
		catch: (cause: unknown) => new HashingError({operation: 'hash', cause}),
	}).pipe(retryHasher)
})

/** Verifies that a given hashed string and target match using Argon2id */
export const verifyTarget = Effect.fn('verifyTarget')(function* (hash: string, password: string) {
	const stub = yield* HashingStub

	return yield* Effect.tryPromise({
		try: () => stub.verifyPassword(hash, password),
		catch: (cause: unknown) => new HashingError({operation: 'verify', cause}),
	}).pipe(retryHasher)
})

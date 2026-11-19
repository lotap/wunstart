// `nodeBuiltinImport` suggests Effect's Crypto service; it exposes random bytes
// and digests but not the HKDF that key derivation needs. node:crypto provides
// HKDF in both the Workers and Node runtimes.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import {hkdf, randomBytes} from 'node:crypto'

import {Effect, Redacted, Schema} from 'effect'
import type {JWTHeaderParameters} from 'jose'

import {opsFailure} from '#/db/ops/ops-error.ts'

/** Infrastructure failure while deriving a token key. */
class JwtKeyDerivationError extends Schema.TaggedError<
	JwtKeyDerivationError,
	{readonly brand: unique symbol}
>()('JwtKeyDerivationError', {cause: Schema.Defect()}) {}

/** Purpose tag for HKDF domain separation, one per token type. */
export type TokenPurpose = 'access' | 'refresh' | 'refresh-grace' | 'anon'

/**
 * Derives an encryption key from the provided secret and salt.
 * Uses the HKDF function to ensure uniform randomness in the generated key, even if the secret is weak.
 * The purpose tag binds the derived key to a single token type (RFC 5869 §3.2)
 */
export function deriveHashKey({
	secret,
	salt,
	purpose,
}: {
	secret: Parameters<typeof hkdf>[1]
	salt: Parameters<typeof hkdf>[2]
	purpose: TokenPurpose
}) {
	return Effect.callback<Uint8Array, JwtKeyDerivationError>((resume) => {
		hkdf('sha256', secret, salt, `Generated for Wunstart:${purpose}`, 32, (err, derivedKey) => {
			if (err) return resume(Effect.fail(new JwtKeyDerivationError({cause: err})))
			resume(Effect.succeed(new Uint8Array(derivedKey)))
		})
	})
}

/** Generates a salt and uses {@link deriveHashKey} to generate a unique key for a token purpose */
export const generateSaltedKey = Effect.fn('generateSaltedKey')(function* (
	secretsEntries: [id: string, secret: Redacted.Redacted][],
	purpose: TokenPurpose,
) {
	if (!secretsEntries[0]) return yield* Effect.die(new Error('secretEntries cannot be empty'))

	const [kid, secret] = secretsEntries[0]
	const salt = randomBytes(32).toString('base64url')
	const key = yield* deriveHashKey({secret: Redacted.value(secret), salt, purpose})

	return {kid, salt, key}
})

/**
 * Generates the decryption key by using the provided `kid` and `s` headers of a given JWT.
 * The `s` header is a custom one used for managing a unique salt per token.
 * Looks up the corresponding secret from the given secretsMap and uses HKDF to derive the key.
 *
 * This function is passed to `jwtDecrypt` and `jwtVerify` from `jose` directly - it MUST return a promise, not an effect
 */
export function getKeyFromSecretsMap(
	secretsMap: Map<string, Redacted.Redacted>,
	purpose: TokenPurpose,
) {
	return function getKey({
		kid,
		s,
	}: JWTHeaderParameters & {
		s?: string
	}) {
		if (!kid) throw new Error('`kid` claim is missing in the header parameters')

		if (!s) throw new Error('`s` claim is missing in the header parameters')

		const secret = secretsMap.get(kid)

		if (!secret) throw new Error('Unknown `kid` claim')

		return Effect.runPromise(deriveHashKey({secret: Redacted.value(secret), salt: s, purpose}))
	}
}

/** Tagged Error for capturing if `jose` functions throw while reading/writing tokens */
export class JwtHandlerError extends Schema.TaggedError<
	JwtHandlerError,
	{readonly brand: unique symbol}
>()('JwtHandlerError', {
	operation: Schema.Literals(['sign', 'verify', 'encrypt', 'decrypt', 'parse'] as const),
	cause: Schema.Defect(),
}) {}

/** Determine if passed JwtHandlerError is a JwtKeyDerivationError */
export const isJwtKeyDerivationError = (error: JwtHandlerError) =>
	Schema.is(JwtKeyDerivationError)(error.cause)

/**
 * Ops failure for HKDF infra errors. Weight 0 so it never feeds ban thresholds.
 *
 * Uses generic `opsFailure` (not `createOpsFailure`) because no caller discriminates
 * by tag; the ops-error contract's dedicated classes are for `catchTag` classifiers
 * (`AuthTokenError`/`RateLimitError` in `verify-auth`/`verify-anon`), and this is
 * intentionally erased to `INTERNAL_ERROR`.
 */
export const hkdfFailure = (error: JwtHandlerError) =>
	opsFailure({
		failureCause: 'INTERNAL_ERROR',
		rateAllowance: Infinity,
		meta: {operation: error.operation},
		message: 'Something went wrong. Please try again later.',
	})

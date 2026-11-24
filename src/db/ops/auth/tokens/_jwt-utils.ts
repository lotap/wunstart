// `nodeBuiltinImport` suggests Effect's Crypto service; it exposes random bytes
// and digests but not the HKDF that key derivation needs. node:crypto provides
// HKDF in both the Workers and Node runtimes.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import {hkdf, randomBytes} from 'node:crypto'

import {Effect, Redacted, Schema} from 'effect'
import {errors, type JWTHeaderParameters} from 'jose'

import {opsFailure} from '#/db/ops/ops-error.ts'

import {AUTH_INTERNAL_FAILURE_MESSAGE} from './_messages.ts'

/** Infrastructure failure while deriving a token key. */
class JwtKeyDerivationError extends Schema.TaggedError<
	JwtKeyDerivationError,
	{readonly brand: unique symbol}
>()('JwtKeyDerivationError', {cause: Schema.Defect()}) {}

/**
 * HKDF `info` tag binding a key to one token type: a key derived for one type
 * cannot verify or decrypt another, even if a secret set is shared or
 * misconfigured. The tag is public, so it hardens by separating key spaces, not
 * by protecting the raw secret.
 *
 * Changing a tag invalidates tokens of that type minted before the change.
 */
export type TokenPurpose = 'access' | 'refresh' | 'refresh-grace' | 'anon'

/**
 * Derives one token key from the `kid` secret, the token’s fresh random salt
 * (its `s` header), and the purpose tag. Minting writes `kid` and `s` into the
 * header; {@link getKeyFromSecretsMap} re-derives from them at verification.
 * HKDF output is uniform even from a weak secret and one-way, so a leaked
 * derived key does not expose the raw secret.
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
		hkdf('sha256', secret, salt, `Generated with wunstart | ${purpose}`, 32, (err, derivedKey) => {
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
 * The token header names a `kid` that is absent from the current secret map.
 * A genuine rotated-out token and a forged header are indistinguishable, so
 * callers treat this as a rotation state; the verifier cannot choose a key to
 * test. The request caps bound repeated attempts.
 */
export class UnknownKidError extends Schema.TaggedError<
	UnknownKidError,
	{readonly brand: unique symbol}
>()('UnknownKidError', {kid: Schema.String}) {}

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

		if (!secret) throw new UnknownKidError({kid})

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

/** Determine if passed JwtHandlerError is an unknown-kid header failure */
export const isUnknownKidError = (error: JwtHandlerError) => Schema.is(UnknownKidError)(error.cause)

/**
 * True when jose rejected an otherwise authenticated token only because its
 * `exp` claim had passed. The signature or decryption held, so the caller
 * presented a genuine credential past its lifetime — the ordinary end of a
 * Session, not a failed credential presentation.
 */
export const isJwtExpiredError = (error: JwtHandlerError) =>
	error.cause instanceof errors.JWTExpired

/**
 * Ordered classification; `hkdf` is infrastructure, not a token verdict.
 * This is a classification input, not an activity `failureCause`.
 */
export type JwtFailureVerdict = 'expired' | 'invalid' | 'unknown-kid' | 'hkdf'

/** Classify a `JwtHandlerError` by precedence; `hkdf` is infrastructure, not a token verdict. */
export const jwtFailureVerdict = (error: JwtHandlerError): JwtFailureVerdict => {
	if (isJwtKeyDerivationError(error)) return 'hkdf'

	if (isJwtExpiredError(error)) return 'expired'

	if (isUnknownKidError(error)) return 'unknown-kid'

	return 'invalid'
}

/** Cause and allowance for one token verdict. Weight is derived by `createOpsFailure`. */
export type TokenFailurePolicy = {
	readonly failureCause: string
	readonly rateAllowance: number
}

/**
 * Ops failure for HKDF infra errors. Weight 0 so it never feeds ban thresholds.
 *
 * Uses generic `opsFailure` (not `createOpsFailure`) because no caller discriminates
 * by type; the contract's dedicated classes exist for the boundaries that classify
 * (`verify-auth`, `runOp`), and this is intentionally erased to `INTERNAL_ERROR`.
 */
export const hkdfFailure = (error: JwtHandlerError) =>
	opsFailure({
		failureCause: 'INTERNAL_ERROR',
		rateAllowance: Infinity,
		meta: {operation: error.operation},
		message: AUTH_INTERNAL_FAILURE_MESSAGE,
	})

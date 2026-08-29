import {randomBytes} from 'node:crypto'

import {DateTime, Effect, Schema} from 'effect'
import {jwtVerify, SignJWT} from 'jose'

import {DateTimeUtcFromSeconds, UUID} from '#/db/helpers/validators.ts'
import {hashTarget} from '#/db/ops/auth/_hashing.ts'

import {RefreshTokenSecretsConfig} from './_auth-layer.ts'
import {generateSaltedKey, getKeyFromSecretsMap, JwtHandlerError} from './_jwt-utils.ts'

/** Set the algorithm for the JWS */
const alg = 'HS256'

/** Generates a cspr base64 url-encoded string and its hash */
export const generateNonce = Effect.fn('generateNonce')(function* () {
	const nonce = randomBytes(32).toString('base64url')
	return {
		nonce,
		nonceHash: yield* hashTarget(nonce),
	}
})

/** A generated refresh nonce paired with its Argon2id hash */
export type NonceWithHash = Effect.Success<ReturnType<typeof generateNonce>>

/**
 * Payload of refresh token. Handles transformations between DateTimes and numbers/strings
 * `generation` is signed so stale generations can be classified without retaining old nonce hashes
 */
const RefreshTokenPayload = Schema.Struct({
	exp: DateTimeUtcFromSeconds,
	sessionId: UUID,
	nonce: Schema.String,
	generation: Schema.Int,
})

export type RefreshTokenPayloadCustomClaims = Omit<(typeof RefreshTokenPayload)['Type'], 'exp'>

/**
 * Generates a JSON Web Signature (JWS) token with a random nonce.
 * This implementation generates a unique salt per token that is stored in a custom `s` header.
 * Using a unique salt per token mitigates some risks of rainbow table attacks and limits exposure if the derived key is compromised
 *
 * The nonce must be generated (and hashed) by {@link generateNonce} outside any database
 * transaction before calling this. Hashing runs on the AuthHasher Durable Object and
 * must never run while a transaction is open
 */
export const generateRefreshToken = Effect.fn('generateRefreshToken')(function* ({
	exp,
	sessionId,
	generation,
	nonce,
}: {
	exp: DateTime.Utc
	sessionId: string
	generation: number
	nonce: string
}) {
	const {secretsEntries} = yield* RefreshTokenSecretsConfig
	const {kid, salt, key} = yield* generateSaltedKey(secretsEntries)

	return yield* Effect.tryPromise({
		try: () =>
			new SignJWT({nonce, sessionId, generation})
				.setProtectedHeader({alg, kid, s: salt})
				.setExpirationTime(DateTime.toDate(exp))
				.sign(key, {crit: {kid: true, s: true}}),
		catch: (cause) => new JwtHandlerError({operation: 'sign', cause}),
	})
})

/** Verifies the signature of the given JWS token using {@link getKeyFromSecretsMap} and returns its payload */
export const extractRefreshTokenPayload = Effect.fn('extractRefreshTokenPayload')(function* (
	token: Parameters<typeof jwtVerify>[0],
) {
	const {secretsMap} = yield* RefreshTokenSecretsConfig

	const {payload} = yield* Effect.tryPromise({
		try: () => jwtVerify(token, getKeyFromSecretsMap(secretsMap), {algorithms: [alg]}),
		catch: (cause) => new JwtHandlerError({operation: 'verify', cause}),
	})

	return yield* Schema.decodeUnknownEffect(RefreshTokenPayload)(payload).pipe(
		Effect.mapError((cause) => new JwtHandlerError({operation: 'parse', cause})),
	)
})

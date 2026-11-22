// `nodeBuiltinImport` suggests Effect's Crypto service, which needs a platform
// layer this app does not install. node:crypto is available in both the Workers
// and Node runtimes.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import {timingSafeEqual} from 'node:crypto'

import {Effect, Schema} from 'effect'
import {EncryptJWT, jwtDecrypt} from 'jose'

import {RefreshGraceTokenSecretsConfig} from '../_auth-layer.ts'
import {generateSaltedKey, getKeyFromSecretsMap, JwtHandlerError} from './_jwt-utils.ts'
import {generateNonce} from './_refresh-token.ts'

const alg = 'dir'
const enc = 'A256GCM'

const RefreshGraceTokenPayload = Schema.Struct({
	previousNonce: Schema.String,
	nonce: Schema.String,
	generation: Schema.Int,
})

/** Constant-time comparison for grace-slot nonces */
export const noncesMatch = (a: string, b: string) => {
	const encoder = new TextEncoder()
	const left = encoder.encode(a)
	const right = encoder.encode(b)

	if (left.byteLength !== right.byteLength) return false

	return timingSafeEqual(left, right)
}

/**
 * Encrypts a successive nonce into a jwe so it can be stored AND extracted from the db
 * without storing it as plaintext.
 *
 * Uses a dedicated secret set (`REFRESH_GRACE_TOKEN_SECRETS`) rather than the refresh
 * signing secrets, so a combined leak of the signing secrets and the database cannot
 * recover the plaintext successor nonce from the grace slot.
 *
 * The successive nonce allows refresh token reuse within a time window, preventing
 * sign-in issues from network latency or races.
 */
export const generateRefreshGraceToken = Effect.fn('generateRefreshGraceToken')(function* ({
	generation,
	previousNonce,
}: Omit<(typeof RefreshGraceTokenPayload)['Type'], 'nonce'>) {
	const {secretsEntries} = yield* RefreshGraceTokenSecretsConfig
	const {kid, salt, key} = yield* generateSaltedKey(secretsEntries, 'refresh-grace')

	const {nonce, nonceHash} = yield* generateNonce()

	const token = yield* Effect.tryPromise({
		try: () =>
			new EncryptJWT({previousNonce, nonce, generation})
				.setProtectedHeader({alg, enc, kid, s: salt})
				.encrypt(key, {crit: {kid: true, s: true}}),
		catch: (cause) => new JwtHandlerError({operation: 'encrypt', cause}),
	})

	return {
		token,
		nonce,
		nonceHash,
	}
})

/** Decrypts a grace token produced by {@link generateRefreshGraceToken} */
export const extractRefreshGraceToken = Effect.fn('extractRefreshGraceToken')(function* (
	token: string,
) {
	const {secretsMap} = yield* RefreshGraceTokenSecretsConfig

	const {payload} = yield* Effect.tryPromise({
		try: () =>
			jwtDecrypt(token, getKeyFromSecretsMap(secretsMap, 'refresh-grace'), {
				contentEncryptionAlgorithms: [enc],
			}),
		catch: (cause) => new JwtHandlerError({operation: 'decrypt', cause}),
	})

	return yield* Schema.decodeUnknownEffect(RefreshGraceTokenPayload)(payload).pipe(
		Effect.mapError((cause) => new JwtHandlerError({operation: 'parse', cause})),
	)
})

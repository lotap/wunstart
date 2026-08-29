import {DateTime, Effect, Schema} from 'effect'
import {EncryptJWT, jwtDecrypt} from 'jose'

import {DateTimeUtcFromSeconds, UUID} from '#/db/helpers/validators.ts'

import {AccessTokenSecretsConfig} from './_auth-layer.ts'
import {generateSaltedKey, getKeyFromSecretsMap, JwtHandlerError} from './_jwt-utils.ts'

/** The window of time that the access token will remain valid */
const ACCESS_TOKEN_EXPIRATION_MILLISECONDS = 15 * 60 * 1000 // 15 minutes

/** Set the algorithm for the JWE */
const alg = 'dir'
/** Set the encoding for the JWE */
const enc = 'A256GCM'

/** Payload of access token. Handles transformations between DateTimes and numbers/strings */
const AccessTokenPayload = Schema.Struct({
	exp: DateTimeUtcFromSeconds,
	userId: UUID,
	sudoExpiresAt: Schema.optional(Schema.DateTimeUtcFromString),
})

/**
 * Generates a JSON Web Encryption (JWE) token using the provided payload.
 * This implementation generates a unique salt per token that is stored in a custom `s` header.
 * Using a unique salt per token mitigates some risks of rainbow table attacks and limits exposure if the derived key is compromised
 */
export const generateAccessToken = Effect.fn('generateAccessToken')(function* ({
	userId,
	sudoExpiresAt,
}: Omit<(typeof AccessTokenPayload)['Type'], 'exp'>) {
	const {secretsEntries} = yield* AccessTokenSecretsConfig
	const {kid, salt, key} = yield* generateSaltedKey(secretsEntries)

	const now = yield* DateTime.now
	const exp = DateTime.add(now, {milliseconds: ACCESS_TOKEN_EXPIRATION_MILLISECONDS})

	const token = yield* Effect.tryPromise({
		try: () =>
			new EncryptJWT({
				userId,
				sudoExpiresAt: sudoExpiresAt ? DateTime.formatIso(sudoExpiresAt) : undefined,
			})
				.setProtectedHeader({alg, enc, kid, s: salt})
				.setExpirationTime(DateTime.toDate(exp))
				.encrypt(key, {crit: {kid: true, s: true}}),
		catch: (cause) => new JwtHandlerError({operation: 'encrypt', cause}),
	})

	return {exp, token}
})

/** Decrypts a JWE token using {@link getKeyFromSecretsMap} and returns its payload. */
export const extractAccessTokenPayload = Effect.fn('extractAccessTokenPayload')(function* (
	token: Parameters<typeof jwtDecrypt>[0],
) {
	const {secretsMap} = yield* AccessTokenSecretsConfig

	const {payload} = yield* Effect.tryPromise({
		try: () =>
			jwtDecrypt(token, getKeyFromSecretsMap(secretsMap), {contentEncryptionAlgorithms: [enc]}),
		catch: (cause) => new JwtHandlerError({operation: 'decrypt', cause}),
	})

	return yield* Schema.decodeUnknownEffect(AccessTokenPayload)(payload).pipe(
		Effect.mapError((cause) => new JwtHandlerError({operation: 'parse', cause})),
	)
})

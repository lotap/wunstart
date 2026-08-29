import {randomUUID} from 'node:crypto'

import {DateTime, Effect, Schema} from 'effect'
import {jwtVerify, SignJWT} from 'jose'

import {
	Countries,
	IpAddresses,
	UserAgents,
	DateTimeUtcFromSeconds,
	UUID,
} from '#/db/helpers/validators.ts'

import {AnonTokenSecretsConfig} from './_auth-layer.ts'
import {generateSaltedKey, getKeyFromSecretsMap, JwtHandlerError} from './_jwt-utils.ts'

/** Set the algorithm for the JWS */
const alg = 'HS256'

/** Payload of anon token. Handles transformations between DateTimes and numbers/strings */
const AnonTokenPayload = Schema.Struct({
	iat: DateTimeUtcFromSeconds,
	id: UUID,
	createdAt: Schema.DateTimeUtcFromString,
	ipAddresses: IpAddresses,
	userAgents: UserAgents,
	countries: Countries,
	registered: Schema.Boolean,
})

export type AnonTokenPayloadCustomClaims = Omit<(typeof AnonTokenPayload)['Type'], 'iat'>

/**
 * Generates a JSON Web Signature (JWS) token with a random uuid.
 * This implementation generates a unique salt per token that is stored in a custom `s` header.
 * Using a unique salt per token mitigates some risks of rainbow table attacks and limits exposure if the derived key is compromised
 */
export const generateAnonToken = Effect.fn('generateAnonToken')(function* ({
	id = randomUUID(),
	createdAt,
	ipAddresses = [],
	userAgents = [],
	countries = [],
	registered = false,
}: Partial<AnonTokenPayloadCustomClaims> = {}) {
	const issuedAt = createdAt ?? (yield* DateTime.now)

	const {secretsEntries} = yield* AnonTokenSecretsConfig
	const {kid, salt, key} = yield* generateSaltedKey(secretsEntries)

	const payload = {id, createdAt: issuedAt, ipAddresses, userAgents, countries, registered}

	const token = yield* Effect.tryPromise({
		try: () =>
			new SignJWT({...payload, createdAt: DateTime.formatIso(issuedAt)})
				.setProtectedHeader({alg, kid, s: salt})
				.setIssuedAt()
				.sign(key),
		catch: (cause) => new JwtHandlerError({operation: 'sign', cause}),
	})

	return {token, payload}
})

/** Verifies the signature of the given JWS token using {@link getKeyFromSecretsMap} and returns its payload */
export const extractAnonTokenPayload = Effect.fn('extractAnonTokenPayload')(function* (
	token: Parameters<typeof jwtVerify>[0],
) {
	const {secretsMap} = yield* AnonTokenSecretsConfig

	const {payload} = yield* Effect.tryPromise({
		try: () => jwtVerify(token, getKeyFromSecretsMap(secretsMap), {algorithms: [alg]}),
		catch: (cause) => new JwtHandlerError({operation: 'verify', cause}),
	})

	return yield* Schema.decodeUnknownEffect(AnonTokenPayload)(payload).pipe(
		Effect.mapError((cause) => new JwtHandlerError({operation: 'parse', cause})),
	)
})

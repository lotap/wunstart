// `nodeBuiltinImport` suggests Effect's Crypto service, which needs a platform
// layer this app does not install. node:crypto is available in both the Workers
// and Node runtimes.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import {randomUUID} from 'node:crypto'

import {DateTime, Effect, Schema} from 'effect'
import {jwtVerify, SignJWT} from 'jose'

import {
	Cities,
	Countries,
	IpAddresses,
	Regions,
	UserAgents,
	DateTimeUtcFromSeconds,
	UUID,
} from '#/db/helpers/validators.ts'

import {AnonTokenSecretsConfig} from '../_auth-layer.ts'
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
	cities: Cities,
	regions: Regions,
	registered: Schema.Boolean,
})

export type AnonTokenPayloadCustomClaims = Omit<(typeof AnonTokenPayload)['Type'], 'iat'>

/**
 * Cookie-carried per-array caps, sized against a soft 3.5KB signed-token budget.
 * Typical ASCII metadata (two 512-byte user agents plus location history)
 * measured ~3,458 bytes. These caps are not a hard UTF-8-byte guarantee: header
 * values can be multi-byte, and a hostile client can exceed the browser cookie
 * limit for its own anon identity — the browser drops the cookie and the next
 * request issues a fresh anon. The database arrays have their own 32-entry
 * bound; these caps are separate. They live with the signed-payload schema they
 * bound, not in the shared constants module.
 */
export const ANON_METADATA_COOKIE_CAPS = {
	ipAddresses: 6,
	userAgents: 2,
	countries: 4,
	cities: 5,
	regions: 5,
} as const

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
	cities = [],
	regions = [],
	registered = false,
}: Partial<AnonTokenPayloadCustomClaims> = {}) {
	const issuedAt = createdAt ?? (yield* DateTime.now)

	const {secretsEntries} = yield* AnonTokenSecretsConfig
	const {kid, salt, key} = yield* generateSaltedKey(secretsEntries, 'anon')

	const payload = {
		id,
		createdAt: issuedAt,
		ipAddresses,
		userAgents,
		countries,
		cities,
		regions,
		registered,
	}

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
		try: () => jwtVerify(token, getKeyFromSecretsMap(secretsMap, 'anon'), {algorithms: [alg]}),
		catch: (cause) => new JwtHandlerError({operation: 'verify', cause}),
	})

	return yield* Schema.decodeUnknownEffect(AnonTokenPayload)(payload).pipe(
		Effect.mapError((cause) => new JwtHandlerError({operation: 'parse', cause})),
	)
})

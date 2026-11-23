import {DateTime, Effect} from 'effect'

import {ipNetwork} from '#/db/helpers/ip-network.ts'
import {isClientIpAddress} from '#/db/helpers/ip-sentinels.ts'
import {DB} from '#/db/index.ts'
import {AUTH_ATTEMPT_ALLOWANCE} from '#/db/models/auth-attempts/consts.ts'
import * as sessionsUsersQueries from '#/db/models/sessions---users/queries.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {retryTransientDb, retryTransientOrArchiveRace} from '#/db/ops/_retry.ts'
import {reserveAttempt, skipsCredentialAttempt} from '#/db/ops/auth/_attempt-counter.ts'
import {DUMMY_ARGON2_HASH, hashTarget, verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {formatUserAgent} from '#/db/ops/auth/_user-agent.ts'
import {retireAnon} from '#/db/ops/auth/anons/_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from '#/db/ops/auth/consts.ts'
import {createSession} from '#/db/ops/auth/sessions/_create-session.ts'
import {generateAccessToken} from '#/db/ops/auth/tokens/_access-token.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/tokens/_anon-token.ts'
import {generateNonce} from '#/db/ops/auth/tokens/_refresh-token.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {attemptCeilingFailure, rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderSignInNotification} from '#/email/templates/sign-in-notification.tsx'
import {EmailPasswordCredentials} from '#/isomorphic/validations/auth.ts'

import {needsRehash} from './_check-rehash.ts'
import {PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE} from './_messages.ts'

/**
 * Burn the same Wasm work as a real password check on paths with no hash to
 * verify, keeping sign-in latency uniform for unknown and passwordless emails.
 * Sharded by the caller's anon identity, never the target user's.
 */
const verifyDummyPassword = (password: string, hasherId: string) =>
	verifyTarget(DUMMY_ARGON2_HASH, password).pipe(
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.provide(HashingStub.layer(hasherId)),
	)

/**
 * Authenticate a user and start an associated session.
 *
 * WARNING: The activitiesLog/rate-limiting mechanism has inherent attack vectors
 * An attacker could continuously submit credentials to hog db resources and drive up costs
 * If that becomes a problem, some solutions are:
 *   move the server behind a firewall/proxy
 *   add a (captcha) challenge for bot detection
 *   use a materialized view and/or store the results in a cache
 *   add better rate-limiting using in-memory storage
 */
const _passwordSignIn = Effect.fn('passwordSignIn')(function* ({
	input: {email, password},
	ipAddress,
	userAgent,
	country,
	city,
	region,
	timezone,
	anonTokenPayload,
}: {
	input: (typeof EmailPasswordCredentials)['Type']
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	timezone: string | null
	anonTokenPayload: AnonTokenPayloadCustomClaims
}) {
	const registeredAnonId = anonTokenPayload.registered ? anonTokenPayload.id : undefined

	/** Before processing, check if the ip address or email should be ratelimited */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		anonId: registeredAnonId,
		failedCredential: email,
	})

	/**
	 * If active bans or excessive activities are found for the ip address
	 * log the activity as a rate limit failure and return a generic error
	 */
	if (
		currentBansAndExcessiveActivities.filter((element) => element.scope !== 'FAILED_CREDENTIAL')
			.length
	)
		return yield* rateLimitFailure({
			message: PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	/** Attempt to find the user for the given credentials */
	const [user] = yield* sessionsUsersQueries.selectUserWithKnownIpByEmail({email, ipAddress})

	/**
	 * If the credential has bans or excessive activities AND this is not a known
	 * network for an existing user, reject with rateLimitFailure before running
	 * Argon2id. This allows a legitimate user on a known network to sign in during
	 * a brute-force attack, while routing unknown-network denial weight to
	 * IP_ADDRESS scope without extending the credential ban or burning AuthHasher
	 * DO CPU.
	 */
	if (
		currentBansAndExcessiveActivities.filter((element) => element.scope === 'FAILED_CREDENTIAL')
			.length &&
		(!user || !isClientIpAddress(ipAddress) || !user.hasKnownIp)
	)
		return yield* rateLimitFailure({
			message: PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	/**
	 * Bound credential presentations per target before any hashing. The ban
	 * pre-check above is a read, so a concurrent burst can all pass it before any
	 * failure is logged and a ban exists; this counter is the race-free throughput
	 * bound. The network counter always counts; the credential counter follows the
	 * known-network escape above, so an attacker elsewhere cannot exhaust the
	 * owner’s budget
	 */
	const networkAttempt = yield* reserveAttempt({
		scope: 'NETWORK',
		target: ipNetwork(ipAddress),
		allowance: AUTH_ATTEMPT_ALLOWANCE.network,
	})

	/** Undefined when the escape applies: a known network does not spend the credential counter */
	const credentialAttempt = skipsCredentialAttempt({user, ipAddress})
		? undefined
		: yield* reserveAttempt({
				scope: 'CREDENTIAL',
				target: email,
				allowance: AUTH_ATTEMPT_ALLOWANCE.credential,
			})

	if (!networkAttempt.allowed || credentialAttempt?.allowed === false)
		return yield* attemptCeilingFailure({
			message: PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE,
			/** Ceiling denials carry weight 0; meta keeps the email for audit only */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	/** If no user is found, run dummy verification for timing uniformity, then fail */
	if (!user) {
		yield* verifyDummyPassword(password, anonTokenPayload.id)

		return yield* opsFailure({
			failureCause: 'USER_NOT_FOUND',
			failedCredential: email,
			anonId: registeredAnonId,
			rateAllowance: 10,
			message: PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE,
		})
	}

	const {id: userId, passwordHash, email: userEmail} = user

	if (!passwordHash) {
		yield* verifyDummyPassword(password, anonTokenPayload.id)

		return yield* opsFailure({
			failureCause: 'NO_PASSWORD_ON_USER',
			failedCredential: email,
			anonId: registeredAnonId,
			rateAllowance: 10,
			message: PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE,
		})
	}

	return yield* Effect.gen(function* () {
		const isPasswordVerified = yield* verifyTarget(passwordHash, password)

		if (!isPasswordVerified)
			return yield* opsFailure({
				failureCause: 'WRONG_PASSWORD',
				failedCredential: email,
				anonId: registeredAnonId,
				rateAllowance: 10,
				message: PASSWORD_SIGN_IN_GENERIC_FAILURE_MESSAGE,
			})

		/** Update the password hash if the hash config has changed */
		if (needsRehash(passwordHash)) {
			const newHash = yield* hashTarget(password)
			/**
			 * Compare-and-swap on the hash that was just verified: if a concurrent
			 * password change committed a newer hash in the meantime, the update
			 * matches zero rows and the newer password stays authoritative
			 */
			yield* retryTransientDb(
				usersQueries.updatePasswordHashIfMatches({
					id: userId,
					passwordHash,
					newHash,
				}),
			)
		}

		const db = yield* DB
		const now = yield* DateTime.now

		/**
		 * Generate the refresh nonce/hash through the AuthHasher DO before the
		 * transaction opens. Hashing must never run inside a database transaction
		 */
		const {nonce, nonceHash} = yield* generateNonce()

		/**
		 * Wrap the auth processes in a transaction
		 *
		 * A failed createSession must not leave the anon retired with no session
		 * behind it. The archive is append-only and `retireAnon` recovers an
		 * existing row on replay, so this is about atomicity, not uniqueness.
		 */
		const [session, access, retiredAnon] = yield* retryTransientOrArchiveRace(
			db.transaction((tx) =>
				/** Concurrently create a session, archive the anon token if it exists, and generate an access token. */
				Effect.all(
					[
						createSession(
							{userId, ipAddress, userAgent, country, city, region, nonce, nonceHash},
							tx,
						),
						generateAccessToken({
							userId,
							sudoExpiresAt: DateTime.add(now, {milliseconds: SUDO_EXPIRATION_WINDOW}),
						}),
						retireAnon(
							{tokenData: anonTokenPayload, userId, ipAddress, userAgent, country, city, region},
							tx,
						),
					],
					{concurrency: 'unbounded'},
				),
			),
		)

		/**
		 * Send a notification email as a side-effect
		 *
		 * Don't fail whole operation on missend, but log the failure
		 */
		yield* Effect.gen(function* () {
			const {send, appUrl} = yield* EmailService

			const {html, text, subject} = yield* Effect.tryPromise({
				try: () =>
					renderSignInNotification({
						appUrl,
						ipAddress,
						occurredAt: DateTime.toDate(now),
						country,
						city,
						region,
						timezone,
						device: formatUserAgent(userAgent),
					}),
				catch: (cause) =>
					new EmailRenderError({
						message: cause instanceof Error ? cause.message : String(cause),
					}),
			})

			yield* send({to: userEmail, subject, html, text})
		}).pipe(Effect.ignore({log: true, message: 'Failed to dispatch the sign-in notification'}))

		return {
			user: {userId, email: userEmail},
			session,
			access,
			logging: {anonId: null, anonsArchiveId: retiredAnon.archiveId, userId},
		}
	}).pipe(
		// oxlint-disable-next-line effecttsgo/strict-effect-provide
		Effect.provide(HashingStub.layer(userId)),
	)
})

export const passwordSignIn = createOpsFn({
	fn: _passwordSignIn,
	label: 'AUTH_STRATEGIES_PASSWORD_SIGN_IN',
})

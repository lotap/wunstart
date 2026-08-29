import {DateTime, Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as sessionsUsersQueries from '#/db/models/sessions---users/queries.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {hashTarget, verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderSignInNotification} from '#/email/templates/sign-in-notification.tsx'
import {PasswordSignInCredentials} from '#/isomorphic/validations/auth.ts'

import {generateAccessToken} from './_access-token.ts'
import type {AnonTokenPayloadCustomClaims} from './_anon-token.ts'
import {needsRehash} from './_check-rehash.ts'
import {createSession} from './_create-session.ts'
import {generateNonce} from './_refresh-token.ts'
import {retireAnon} from './_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from './consts.ts'

const genericFailureOutputMessage =
	'That email and password don’t match. Double-check them and try again.'

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
	anonTokenPayload,
}: {
	input: (typeof PasswordSignInCredentials)['Type']
	ipAddress: string
	userAgent: string
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
			message: genericFailureOutputMessage,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	/** Attempt to find the user for the given credentials */
	const [user] = yield* sessionsUsersQueries.selectUserWithIpAddressesByEmail({email})

	/** If no user is found, throw an error */
	if (!user)
		return yield* opsFailure({
			failureCause: 'USER_NOT_FOUND',
			failedCredential: email,
			anonId: registeredAnonId,
			rateAllowance: 4,
			message: genericFailureOutputMessage,
		})

	const {id: userId, ipAddresses, passwordHash, email: userEmail} = user

	if (!passwordHash)
		return yield* opsFailure({
			failureCause: 'NO_PASSWORD_ON_USER',
			failedCredential: email,
			anonId: registeredAnonId,
			rateAllowance: 4,
			message: genericFailureOutputMessage,
		})

	/**
	 * If the credential used to find the user has bans or excessive activities
	 * AND this is a new ip address for the user throw an error.
	 * This will allow a user to log in with a known ip address if a bad actor is trying to brute-force lock them out
	 * it will also prevent brute-force attacks where a bad actor switches ip addresses for several attempts at guessing a password
	 */
	if (
		currentBansAndExcessiveActivities.filter((element) => element.scope === 'FAILED_CREDENTIAL')
			.length &&
		!ipAddresses.includes(ipAddress)
	)
		return yield* rateLimitFailure({
			message: genericFailureOutputMessage,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	return yield* Effect.gen(function* () {
		const isPasswordVerified = yield* verifyTarget(passwordHash, password)

		if (!isPasswordVerified)
			return yield* opsFailure({
				failureCause: 'WRONG_PASSWORD',
				failedCredential: email,
				anonId: registeredAnonId,
				rateAllowance: 4,
				message: genericFailureOutputMessage,
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
		 * If retireAnon succeeds and createSession fails, it could cause an issue where the anon cannot sign-in
		 * because of the unique constraint of the anonsArchive. The transaction ensures that state can't be reached.
		 */
		const [session, access, retiredAnon] = yield* retryTransientDb(
			db.transaction((tx) =>
				/** Concurrently create a session, archive the anon token if it exists, and generate an access token. */
				Effect.all(
					[
						createSession({userId, ipAddress, userAgent, nonce, nonceHash}, tx),
						generateAccessToken({
							userId,
							sudoExpiresAt: DateTime.add(now, {milliseconds: SUDO_EXPIRATION_WINDOW}),
						}),
						retireAnon({tokenData: anonTokenPayload, userId, ipAddress, userAgent}, tx),
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
			const {html, text, subject} = yield* Effect.tryPromise({
				try: () => renderSignInNotification({ipAddress, signedInAt: DateTime.toDate(now)}),
				catch: (cause) =>
					new EmailRenderError({
						message: cause instanceof Error ? cause.message : String(cause),
					}),
			})

			const {send} = yield* EmailService
			yield* send({to: userEmail, subject, html, text})
		}).pipe(Effect.ignore({log: true, message: 'Failed to dispatch the sign-in notification'}))

		return {
			user: {userId, email: userEmail},
			session,
			access,
			logging: {anonId: null, anonsArchiveId: retiredAnon.archiveId, userId},
		}
	}).pipe(Effect.provide(HashingStub.layer(userId)))
})

export const passwordSignIn = createOpsFn({
	fn: _passwordSignIn,
	label: 'AUTH_PASSWORD_SIGN_IN',
})

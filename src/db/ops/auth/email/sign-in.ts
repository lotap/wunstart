import {DateTime, Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as sessionsUsersQueries from '#/db/models/sessions---users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {generateAccessToken} from '#/db/ops/auth/_access-token.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {createSession} from '#/db/ops/auth/_create-session.ts'
import {generateNonce} from '#/db/ops/auth/_refresh-token.ts'
import {retireAnon} from '#/db/ops/auth/_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from '#/db/ops/auth/consts.ts'
import {opsFailure} from '#/db/ops/ops-error.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderSignInNotification} from '#/email/templates/sign-in-notification.tsx'
import {EmailSignInCredentials} from '#/isomorphic/validations/auth.ts'

import {burnPasscode} from './_burn-passcode.ts'
import {verify} from './_verify.ts'

const genericFailureOutputMessage = 'Something went wrong. Double-check your details and try again.'

const _emailSignIn = Effect.fn('emailSignIn')(function* ({
	input: {email, passcode},
	ipAddress,
	userAgent,
	country,
	city,
	region,
	anonTokenPayload,
}: {
	input: (typeof EmailSignInCredentials)['Type']
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	anonTokenPayload: AnonTokenPayloadCustomClaims
}) {
	const {id: anonId} = anonTokenPayload
	/** Only registered anons have a database row, so only their id may populate the FK column */
	const registeredAnonId = anonTokenPayload.registered ? anonId : undefined

	/** Before processing, check if the ip address should be ratelimited */
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

	const {id: userId, ipAddresses, email: userEmail} = user

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

	/**
	 * Verify the passcode outside any transaction. Wrong codes persist their attempt
	 * and fail here; only a verified code proceeds to the authoritative transaction
	 */
	const verification = yield* verify({
		email,
		passcode,
		anonId,
		anonRegistered: anonTokenPayload.registered,
	})

	const db = yield* DB

	return yield* Effect.gen(function* () {
		/**
		 * Generate the refresh nonce/hash through the AuthHasher DO before the
		 * transaction opens. Hashing must never run inside a database transaction
		 */
		const {nonce, nonceHash} = yield* generateNonce()

		const now = yield* DateTime.now

		const {session, access, retiredAnon} = yield* retryTransientDb(
			db.transaction((tx) =>
				Effect.gen(function* () {
					/**
					 * Burn the passcode so it cannot be reused. Fails if a concurrent
					 * submission or reset got there first. Must run before retireAnon so
					 * the anon cascade finds the archive row
					 */
					yield* burnPasscode({
						verification,
						anonId,
						userId,
						email: email,
						tx,
					})

					/** Concurrently create a session, generate an access token, and archive the anon token if it exists. */
					const [_session, _access, _retiredAnon] = yield* Effect.all(
						[
							createSession(
								{userId, ipAddress, userAgent, country, city, region, nonce, nonceHash},
								tx,
							),
							generateAccessToken({
								userId,
								sudoExpiresAt: DateTime.add(now, {
									milliseconds: SUDO_EXPIRATION_WINDOW,
								}),
							}),
							retireAnon(
								{tokenData: anonTokenPayload, userId, ipAddress, userAgent, country, city, region},
								tx,
							),
						],
						{concurrency: 'unbounded'},
					)

					return {session: _session, access: _access, retiredAnon: _retiredAnon}
				}),
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
			session,
			access,
			logging: {anonId: null, anonsArchiveId: retiredAnon.archiveId, userId},
		}
	}).pipe(Effect.provide(HashingStub.layer(userId)))
})

export const emailSignIn = createOpsFn({
	fn: _emailSignIn,
	label: 'AUTH_EMAIL_SIGN_IN',
})

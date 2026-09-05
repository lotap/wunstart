import {DateTime, Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import * as sessionsUsersQueries from '#/db/models/sessions---users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {generateAccessToken} from '#/db/ops/auth/_access-token.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {createSession} from '#/db/ops/auth/_create-session.ts'
import {createUser} from '#/db/ops/auth/_create-user.ts'
import {generateNonce} from '#/db/ops/auth/_refresh-token.ts'
import {retireAnon} from '#/db/ops/auth/_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from '#/db/ops/auth/consts.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderSignInNotification} from '#/email/templates/sign-in-notification.tsx'
import type {EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'

import {formatUserAgent} from '../_user-agent.ts'
import {burnPasscode} from './_burn-passcode.ts'
import {verify} from './_verify.ts'

const genericFailureOutputMessage = 'Something went wrong. Double-check your details and try again.'

type VerifyPasscodeContext = {
	email: string
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	anonTokenPayload: AnonTokenPayloadCustomClaims
}

/**
 * 2FA seam: each branch is `verify (outside tx) -> burn + issue (inside tx)`.
 * A future second factor interposes between verification and issuance: verify
 * returns a grant, and issuance (including `retireAnon`) runs only after the
 * second factor completes. Do not retire the anon or issue a session at
 * verify time for users who will require a second factor.
 */
const signInWithVerifiedCode = Effect.fn('emailVerifyPasscode.signIn')(function* ({
	verification,
	user,
	ctx: {email, ipAddress, userAgent, country, city, region, anonTokenPayload},
}: {
	verification: Effect.Success<ReturnType<typeof verify>>
	user: {
		id: string
		ipAddresses: string[]
		email: string
	}
	ctx: VerifyPasscodeContext
}) {
	const {id: userId, email: userEmail} = user

	return yield* Effect.gen(function* () {
		/**
		 * Generate the refresh nonce/hash through the AuthHasher DO before the
		 * transaction opens. Hashing must never run inside a database transaction
		 */
		const {nonce, nonceHash} = yield* generateNonce()

		const now = yield* DateTime.now

		const db = yield* DB

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
						anonId: anonTokenPayload.id,
						userId,
						email,
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
				try: () =>
					renderSignInNotification({
						ipAddress,
						signedInAt: DateTime.toDate(now),
						country,
						city,
						region,
						device: formatUserAgent(userAgent),
					}),
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

const signUpWithVerifiedCode = Effect.fn('emailVerifyPasscode.signUp')(function* ({
	verification,
	ctx: {email, ipAddress, userAgent, country, city, region, anonTokenPayload},
}: {
	verification: Effect.Success<ReturnType<typeof verify>>
	ctx: VerifyPasscodeContext
}) {
	const {id: anonId} = anonTokenPayload

	const db = yield* DB

	/**
	 * Generate the refresh nonce/hash through the AuthHasher DO before the
	 * transaction opens. Hashing must never run inside a database transaction
	 */
	const sessionNonce = yield* Effect.provide(generateNonce(), HashingStub.layer(anonId))

	return yield* retryTransientDb(
		db.transaction((tx) =>
			Effect.gen(function* () {
				/** Burn the passcode so it cannot be reused. Fails if a concurrent submission or reset got there first */
				yield* burnPasscode({
					verification,
					anonId,
					email,
					tx,
				})

				/** Create a user */
				const {user, session, access} = yield* createUser({
					input: {email},
					anonTokenPayload,
					ipAddress,
					userAgent,
					country,
					city,
					region,
					sessionNonce,
					tx,
				})

				yield* emailVerificationsQueries.archiveAddVerified(
					{id: verification.id, userId: user.id},
					tx,
				)

				return {session, access}
			}),
		),
	)
})

const _emailVerifyPasscode = Effect.fn('emailVerifyPasscode')(function* ({
	input: {email, passcode},
	ipAddress,
	userAgent,
	country,
	city,
	region,
	anonTokenPayload,
}: {
	input: (typeof EmailPasscodeCredentials)['Type']
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

	const ctx = {email, ipAddress, userAgent, country, city, region, anonTokenPayload}

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

	/** Look up the user. Absence selects the creation branch instead of failing */
	const [user] = yield* sessionsUsersQueries.selectUserWithIpAddressesByEmail({email})

	if (user) {
		/**
		 * If the credential used to find the user has bans or excessive activities
		 * AND this is a new ip address for the user throw an error.
		 * This will allow a user to log in with a known ip address if a bad actor is trying to brute-force lock them out
		 * it will also prevent brute-force attacks where a bad actor switches ip addresses for several attempts at guessing a password
		 */
		if (
			currentBansAndExcessiveActivities.filter((element) => element.scope === 'FAILED_CREDENTIAL')
				.length &&
			!user.ipAddresses.includes(ipAddress)
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

		return yield* signInWithVerifiedCode({verification, user, ctx})
	}

	/**
	 * No user for this email: verify the code, then create the account.
	 * Signup consent stays explicit because creation is reachable only with a
	 * code minted through the sign-up flow.
	 */
	const verification = yield* verify({
		email,
		passcode,
		anonId,
		anonRegistered: anonTokenPayload.registered,
	})

	return yield* signUpWithVerifiedCode({verification, ctx}).pipe(
		Effect.catchTag('OpsError', (error) =>
			/**
			 * Lost the creation race: a user was created for this email between the
			 * lookup and the insert. Fall through to the sign-in branch with the
			 * already-verified code instead of failing.
			 */
			error.activity.failureCause === 'USER_ALREADY_EXISTS'
				? sessionsUsersQueries.selectUserWithIpAddressesByEmail({email}).pipe(
						Effect.flatMap(([racedUser]) => {
							if (!racedUser) return Effect.fail(error)
							return signInWithVerifiedCode({verification, user: racedUser, ctx})
						}),
					)
				: Effect.fail(error),
		),
	)
})

export const emailVerifyPasscode = createOpsFn({
	fn: _emailVerifyPasscode,
	label: 'AUTH_EMAIL_VERIFY_PASSCODE',
})

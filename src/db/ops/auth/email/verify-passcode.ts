import {Effect} from 'effect'

import * as sessionsUsersQueries from '#/db/models/sessions---users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import type {EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'

import {signInWithVerifiedCode} from './_sign-in.ts'
import {signUpWithVerifiedCode} from './_sign-up.ts'
import {verify} from './_verify.ts'

const genericFailureOutputMessage = 'Something went wrong. Double-check your details and try again.'

export type VerifyPasscodeContext = {
	email: string
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	anonTokenPayload: AnonTokenPayloadCustomClaims
}

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

		return {
			isNewUser: false as const,
			...(yield* signInWithVerifiedCode({verification, user, ctx})),
		}
	} else if (currentBansAndExcessiveActivities.length) {
		/**
		 * Provisioning a new account keeps the blanket check: any remaining
		 * (FAILED_CREDENTIAL) bans block first-time entry. There is no known-IP
		 * set to bypass with yet
		 */
		return yield* rateLimitFailure({
			message: genericFailureOutputMessage,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})
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
		Effect.map((result) => ({isNewUser: true as const, ...result})),
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
							return Effect.map(
								signInWithVerifiedCode({verification, user: racedUser, ctx}),
								(result) => ({isNewUser: false as const, ...result}),
							)
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

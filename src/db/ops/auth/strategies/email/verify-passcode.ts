import {Effect, Schema} from 'effect'

import {ipNetwork} from '#/db/helpers/ip-network.ts'
import {isClientIpAddress} from '#/db/helpers/ip-sentinels.ts'
import {AUTH_ATTEMPT_ALLOWANCE} from '#/db/models/auth-attempts/consts.ts'
import * as sessionsUsersQueries from '#/db/models/sessions---users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {reserveAttempt, skipsCredentialAttempt} from '#/db/ops/auth/_attempt-counter.ts'
import {UserAlreadyExistsError} from '#/db/ops/auth/users/_create-user.ts'
import {attemptCeilingFailure, rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import type {EmailPasscodeCredentials} from '#/isomorphic/validations/auth.ts'

import {EMAIL_VERIFY_GENERIC_FAILURE_MESSAGE} from './_messages.ts'
import {signInWithVerifiedCode} from './_sign-in.ts'
import {signUpWithVerifiedCode} from './_sign-up.ts'
import type {VerifyPasscodeContext} from './_verify-passcode-context.ts'
import {verify} from './_verify.ts'

const _emailVerifyPasscode = Effect.fn('emailVerifyPasscode')(function* ({
	input: {email, passcode},
	ipAddress,
	userAgent,
	country,
	city,
	region,
	timezone,
	anonTokenPayload,
}: {
	input: (typeof EmailPasscodeCredentials)['Type']
} & Omit<VerifyPasscodeContext, 'email'>) {
	const {id: anonId} = anonTokenPayload
	/** Only registered anons have a database row, so only their id may populate the FK column */
	const registeredAnonId = anonTokenPayload.registered ? anonId : undefined

	const ctx: VerifyPasscodeContext = {
		email,
		ipAddress,
		userAgent,
		country,
		city,
		region,
		timezone,
		anonTokenPayload,
	}

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
			message: EMAIL_VERIFY_GENERIC_FAILURE_MESSAGE,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	/** Look up the user. Absence selects the creation branch instead of failing */
	const [user] = yield* sessionsUsersQueries.selectUserWithKnownIpByEmail({email, ipAddress})

	if (user) {
		/**
		 * If the credential used to find the user has bans or excessive activities
		 * AND this is a new network for the user throw an error.
		 * This will allow a user to log in from a known network if a bad actor is trying to brute-force lock them out.
		 * It will also prevent brute-force attacks where a bad actor moves to other networks for several attempts at guessing a password
		 */
		if (
			currentBansAndExcessiveActivities.filter((element) => element.scope === 'FAILED_CREDENTIAL')
				.length &&
			(!isClientIpAddress(ipAddress) || !user.hasKnownIp)
		)
			return yield* rateLimitFailure({
				message: EMAIL_VERIFY_GENERIC_FAILURE_MESSAGE,
				/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
				meta: {credential: email},
				anonId: registeredAnonId,
			})
	} else if (currentBansAndExcessiveActivities.length) {
		/**
		 * Provisioning a new account keeps the blanket check: any remaining
		 * (FAILED_CREDENTIAL) bans block first-time entry. There is no known-IP
		 * set to bypass with yet
		 */
		return yield* rateLimitFailure({
			message: EMAIL_VERIFY_GENERIC_FAILURE_MESSAGE,
			/** Denial payload omits failedCredential, so weight routes to IP scope; meta keeps the email for audit */
			meta: {credential: email},
			anonId: registeredAnonId,
		})
	}

	/**
	 * Bound credential presentations per target before hashing. The ban pre-checks
	 * above are reads, so a concurrent burst can all pass them before any failure
	 * is logged and a ban exists; this counter is the race-free throughput bound.
	 * The network counter always counts; the credential counter follows the
	 * known-network escape, so an attacker elsewhere cannot exhaust the owner’s
	 * budget
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
			message: EMAIL_VERIFY_GENERIC_FAILURE_MESSAGE,
			/** Ceiling denials carry weight 0; meta keeps the email for audit only */
			meta: {credential: email},
			anonId: registeredAnonId,
		})

	if (user) {
		/**
		 * Verify the passcode outside any transaction. The attempt is reserved before the
		 * hash, so a wrong code is already counted when the failure is raised; a verified
		 * code proceeds to the authoritative transaction, which burns the row
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
		Effect.catchIf(Schema.is(UserAlreadyExistsError), (error) =>
			/**
			 * Lost the creation race: a user was created for this email between the
			 * lookup and the insert. Fall through to the sign-in branch with the
			 * already-verified code instead of failing.
			 */
			Effect.gen(function* () {
				const [racedUser] = yield* sessionsUsersQueries.selectUserWithKnownIpByEmail({
					email,
					ipAddress,
				})

				if (!racedUser) return yield* error

				return yield* signInWithVerifiedCode({verification, user: racedUser, ctx}).pipe(
					Effect.map((result) => Object.assign({isNewUser: false as const}, result)),
				)
			}),
		),
	)
})

export const emailVerifyPasscode = createOpsFn({
	fn: _emailVerifyPasscode,
	label: 'AUTH_STRATEGIES_EMAIL_VERIFY_PASSCODE',
})

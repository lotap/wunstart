import {Effect} from 'effect'

import {DB} from '#/db/index.ts'
import * as emailVerificationsQueries from '#/db/models/email-verifications/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import type {AnonTokenPayloadCustomClaims} from '#/db/ops/auth/_anon-token.ts'
import {createUser} from '#/db/ops/auth/_create-user.ts'
import {generateNonce} from '#/db/ops/auth/_refresh-token.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailSignUpCredentials} from '#/isomorphic/validations/auth.ts'

import {burnPasscode} from './_burn-passcode.ts'
import {verify} from './_verify.ts'

const genericFailureOutputMessage = 'Something went wrong. Double-check your details and try again.'

const _emailSignUp = Effect.fn('emailSignUp')(function* ({
	input: {email, passcode},
	ipAddress,
	anonTokenPayload,
}: {
	input: (typeof EmailSignUpCredentials)['Type']
	ipAddress: string
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
	 * If active bans or excessive activities are found
	 * log the activity as a rate limit failure and return a generic error
	 */
	if (currentBansAndExcessiveActivities.length)
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
					email: email,
					tx,
				})

				/** Create a user */
				const {user, session, access} = yield* createUser({
					input: {email},
					anonTokenPayload,
					ipAddress,
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

export const emailSignUp = createOpsFn({
	fn: _emailSignUp,
	label: 'AUTH_EMAIL_SIGN_UP',
})

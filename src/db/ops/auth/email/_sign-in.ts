import {DateTime, Effect} from 'effect'

import {DB} from '#/db/index.ts'
import {retryTransientDb} from '#/db/ops/_retry.ts'
import {generateAccessToken} from '#/db/ops/auth/_access-token.ts'
import {createSession} from '#/db/ops/auth/_create-session.ts'
import {generateNonce} from '#/db/ops/auth/_refresh-token.ts'
import {retireAnon} from '#/db/ops/auth/_retire-anon.ts'
import {SUDO_EXPIRATION_WINDOW} from '#/db/ops/auth/consts.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderSignInNotification} from '#/email/templates/sign-in-notification.tsx'

import {formatUserAgent} from '../_user-agent.ts'
import {burnPasscode} from './_burn-passcode.ts'
import {verify} from './_verify.ts'
import type {VerifyPasscodeContext} from './verify-passcode.ts'

export const signInWithVerifiedCode = Effect.fn('emailVerifyPasscode.signIn')(function* ({
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

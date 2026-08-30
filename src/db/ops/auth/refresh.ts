import {DateTime, Effect, Option, Schema} from 'effect'

import * as sessionsQueries from '#/db/models/sessions/queries.ts'
import * as usersQueries from '#/db/models/users/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {checkCurrentBansAndExcessiveActivities} from '#/db/ops/_current-bans-and-excessive-activities.ts'
import {verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {rateLimitFailure} from '#/db/ops/rate-limit-error.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'
import {EmailRenderError, EmailService} from '#/email/service.ts'
import {renderSessionEndedNotification} from '#/email/templates/session-ended-notification.tsx'

import {generateAccessToken} from './_access-token.ts'
import {hkdfFailure, isJwtKeyDerivationError} from './_jwt-utils.ts'
import {generateRefreshGraceToken, extractRefreshGraceToken} from './_refresh-grace-token.ts'
import {
	extractRefreshTokenPayload,
	generateRefreshToken,
	type RefreshTokenPayloadCustomClaims,
} from './_refresh-token.ts'
import {authTokenFailure} from './token-error.ts'

const genericFailureOutputMessage = 'Your session has expired. Sign in and try again.'

/** Unexpected internal session state that prevents safe refresh resolution. Wrapped as INTERNAL_ERROR by createOpsFn */
class RefreshStateError extends Schema.TaggedErrorClass<RefreshStateError>()('RefreshStateError', {
	message: Schema.String,
}) {}

type SessionRow = Effect.Success<
	ReturnType<typeof sessionsQueries.selectFromUnexpiredUnrevoked>
>[number]

/** Loads an unexpired, unrevoked session by id; fails with SESSION_NOT_FOUND if it's missing */
const getSessionRow = Effect.fn('getSessionRow')(function* (sessionId: string) {
	/** Find the session by id */
	const [rowData] = yield* sessionsQueries.selectFromUnexpiredUnrevoked({id: sessionId})

	/** If the session is not found, throw an associated error */
	if (!rowData)
		return yield* authTokenFailure({
			failureCause: 'SESSION_NOT_FOUND',
			meta: {sessionId},
			rateAllowance: 4,
			message: genericFailureOutputMessage,
		})

	return rowData
})

/**
 * Rotates the session to the next refresh generation (Compare And Swap on the current nonce) and
 * mints a fresh access/refresh token pair plus a grace token for the next rotation.
 *
 * Returns none if the CAS missed (caller reloads and reclassifies).
 */
const attemptRotation = Effect.fn('attemptRotation')(function* ({
	nonce,
	rowData,
	ipAddress,
	userAgent,
	country,
	city,
	region,
}: {
	nonce: string
	rowData: SessionRow
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	/** Ensure the refresh token matches the hashed one stored in the database */
	const isNonceVerified = yield* verifyTarget(rowData.nonceHash, nonce)

	if (!isNonceVerified)
		return yield* authTokenFailure({
			failureCause: 'WRONG_NONCE',
			rateAllowance: 4,
			message: genericFailureOutputMessage,
		})

	const now = yield* DateTime.now
	const newExpiresAt = DateTime.add(now, {days: 30})
	const graceExpiresAt = DateTime.add(now, {seconds: 30})

	const {
		token: graceToken,
		nonce: nextNonce,
		nonceHash: nextNonceHash,
	} = yield* generateRefreshGraceToken({
		generation: rowData.refreshGeneration + 1,
	})

	const [updatedSession] = yield* sessionsQueries.rotate({
		id: rowData.id,
		currentNonceHash: rowData.nonceHash,
		refreshGeneration: rowData.refreshGeneration,
		nextNonceHash,
		graceExpiresAt,
		expiresAt: newExpiresAt,
		graceToken,
		ipAddress,
		userAgent,
		country,
		newCities: city ? [city] : [],
		newRegions: region ? [region] : [],
	})

	/**
	 * Compare And Swap miss - row not updated,
	 * likely a concurrent process has changed it
	 */
	if (!updatedSession) return Option.none()

	/** Sign new tokens with the committed generation and expiry */
	const [access, newRefreshToken] = yield* Effect.all(
		[
			generateAccessToken({userId: rowData.userId}),
			generateRefreshToken({
				exp: newExpiresAt,
				sessionId: rowData.id,
				generation: updatedSession.refreshGeneration,
				nonce: nextNonce,
			}),
		],
		{concurrency: 'unbounded'},
	)

	return Option.some({
		userId: updatedSession.userId,
		newAccessToken: access.token,
		accessTokenExpiresAt: access.exp,
		newRefreshToken,
		sessionExpiresAt: newExpiresAt,
	})
})

/**
 * Notifies the account owner that a session was revoked for suspected reuse.
 * Best-effort: failures are logged and swallowed by the caller. The revocation
 * is already committed and the notification is an unimportant side effect.
 */
const notifyReuseReplay = Effect.fn('notifyReuseReplay')(function* ({
	userId,
	ipAddress,
}: {
	userId: string
	ipAddress: string
}) {
	const [user] = yield* usersQueries.selectProfile({id: userId})

	if (!user) {
		yield* Effect.logWarning('Session revoked for reuse, but the user was not found', userId)
		return
	}

	const now = yield* DateTime.now

	const {html, text, subject} = yield* Effect.tryPromise({
		try: () => renderSessionEndedNotification({ipAddress, revokedAt: DateTime.toDate(now)}),
		catch: (cause) =>
			new EmailRenderError({
				message: cause instanceof Error ? cause.message : String(cause),
			}),
	})

	const {send} = yield* EmailService
	yield* send({to: user.email, subject, html, text})
})

/**
 * Revokes session, used when a token more than 1 generation behind is presented
 *
 * Could be the legitimate owner of a refresh token after an attacker has used the token
 */
const revokeForReuse = Effect.fn('revokeForReuse')(function* ({
	session,
	ipAddress,
}: {
	session: SessionRow
	ipAddress: string
}) {
	/** Revoke first. The email is a best-effort notification, never a blocker */
	yield* sessionsQueries.revoke({id: session.id})

	/**
	 * Not a Fork to ensure that a worker isolate does not eject without attempting
	 * the notification. Instead use ignore with logging
	 */
	yield* notifyReuseReplay({userId: session.userId, ipAddress}).pipe(
		Effect.ignore({log: true, message: 'Failed to notify the account owner of session reuse'}),
	)

	return yield* authTokenFailure({
		failureCause: 'REFRESH_TOKEN_REUSE',
		userId: session.userId,
		/** Probably a token theft victim, don't penalize */
		message: genericFailureOutputMessage,
	})
})

/**
 * 1 generation behind token: validates the stored grace token and re-mints access/refresh
 * tokens at the current generation without rotating. Expired grace windows are treated as reuse.
 */
const replayFromGraceToken = Effect.fn('replayFromGraceToken')(function* ({
	session,
	ipAddress,
}: {
	session: SessionRow
	ipAddress: string
}) {
	const {id, userId, graceToken, graceExpiresAt, refreshGeneration, expiresAt} = session

	/** Should be impossible - generations past the initial session should always have grace data */
	if (graceToken === null || graceExpiresAt === null)
		return yield* new RefreshStateError({
			message: 'Grace replay failed: grace token is missing on the session row',
		})

	/** Revoke if not within grace period duration */
	if (graceExpiresAt.getTime() <= DateTime.nowUnsafe().epochMilliseconds)
		return yield* revokeForReuse({session, ipAddress})

	const graceTokenData = yield* extractRefreshGraceToken(graceToken)

	if (graceTokenData.generation !== refreshGeneration)
		return yield* new RefreshStateError({
			message: 'Grace replay failed: grace token generation does not match the session',
		})

	const sessionExpiresAt = DateTime.fromDateUnsafe(expiresAt)

	const [access, newRefreshToken] = yield* Effect.all(
		[
			generateAccessToken({userId}),
			generateRefreshToken({
				exp: sessionExpiresAt,
				sessionId: id,
				generation: refreshGeneration,
				nonce: graceTokenData.nonce,
			}),
		],
		{concurrency: 'unbounded'},
	)

	return Option.some({
		userId,
		newAccessToken: access.token,
		accessTokenExpiresAt: access.exp,
		newRefreshToken,
		sessionExpiresAt,
	})
})

/**
 * Classifies the presented claims against one row.
 * Some = resolved (tokens). None = current-generation CAS missed, caller reloads and re-classifies.
 * Everything else (revoke, invalid, etc.) stays in the typed error channel.
 */
const classifySession = Effect.fn('classifySession')(function* ({
	rowData,
	tokenData: {generation, nonce},
	ipAddress,
	userAgent,
	country,
	city,
	region,
}: {
	rowData: SessionRow
	tokenData: RefreshTokenPayloadCustomClaims
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	/** Current generation - rotate and create fresh access/refresh tokens */
	if (generation === rowData.refreshGeneration)
		return yield* attemptRotation({nonce, rowData, ipAddress, userAgent, country, city, region})

	/** Single generation behind - use grace token to create access/refresh tokens */
	if (generation === rowData.refreshGeneration - 1)
		return yield* replayFromGraceToken({session: rowData, ipAddress})

	/** Several generations old: reuse. Revoke the family */
	if (generation < rowData.refreshGeneration - 1)
		return yield* revokeForReuse({session: rowData, ipAddress})

	/** Future generation: invalid, not reuse. Do not revoke */
	return yield* authTokenFailure({
		failureCause: 'INVALID_REFRESH_GENERATION',
		rateAllowance: 4,
		message: genericFailureOutputMessage,
	})
})

/** Reload-and-reclassify on Compare And Swap misses, bounded. */
const resolveSession = Effect.fn('resolveSession')(function* ({
	tokenData,
	ipAddress,
	userAgent,
	country,
	city,
	region,
	rowData,
	maxAttempts,
}: {
	tokenData: RefreshTokenPayloadCustomClaims
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
	rowData: SessionRow
	maxAttempts: number
}) {
	let currentRow = rowData

	for (let attempts = 0; attempts < maxAttempts; attempts++) {
		const outcome = yield* classifySession({
			rowData: currentRow,
			tokenData,
			ipAddress,
			userAgent,
			country,
			city,
			region,
		})

		if (Option.isSome(outcome)) return outcome.value

		if (attempts + 1 < maxAttempts) currentRow = yield* getSessionRow(tokenData.sessionId)
	}

	return yield* new RefreshStateError({
		message: 'Refresh rotation CAS missed repeatedly: unexpected session state',
	})
})

const _refresh = Effect.fn('refresh')(function* ({
	token,
	ipAddress,
	userAgent,
	country,
	city,
	region,
}: {
	token: string
	ipAddress: string
	userAgent: string
	country: string
	city: string | null
	region: string | null
}) {
	const tokenData = yield* extractRefreshTokenPayload(token).pipe(
		Effect.mapError((error) =>
			isJwtKeyDerivationError(error)
				? hkdfFailure(error)
				: authTokenFailure({
						failureCause: 'INVALID_JWS',
						meta: {operation: error.operation},
						rateAllowance: 4,
						message: genericFailureOutputMessage,
					}),
		),
	)

	const session = yield* getSessionRow(tokenData.sessionId)

	/** Before processing, check if the ip address should be ratelimited */
	const currentBansAndExcessiveActivities = yield* checkCurrentBansAndExcessiveActivities({
		ipAddress,
		userId: session.userId,
	})
	/**
	 * If active bans or excessive activities are found
	 * log the activity as a rate limit failure and return a generic error
	 */
	if (currentBansAndExcessiveActivities.length)
		return yield* rateLimitFailure({message: genericFailureOutputMessage, userId: session.userId})

	return yield* resolveSession({
		tokenData,
		rowData: session,
		maxAttempts: 2,
		ipAddress,
		userAgent,
		country,
		city,
		region,
	}).pipe(Effect.provide(HashingStub.layer(session.userId)))
})

/**
 * Verifies the refresh token signature, loads its session, applies
 * ban/rate-limit checks for the caller, then resolves the session to a new token pair.
 */
export const refresh = createOpsFn({fn: _refresh, label: 'AUTH_REFRESH'})

import {Effect, Match} from 'effect'

import * as sessionsQueries from '#/db/models/sessions/queries.ts'
import type {activeTable} from '#/db/models/sessions/schemas.ts'

import {
	hkdfFailure,
	isJwtExpiredError,
	isJwtKeyDerivationError,
	isUnknownKidError,
	type JwtHandlerError,
} from './_jwt-utils.ts'
import {extractRefreshTokenPayload} from './_refresh-token.ts'

type SessionRow = (typeof activeTable)['$inferSelect']

/** Why a verified refresh JWS cannot resolve a live session. */
export type RefreshSessionInvalidReason = 'invalid' | 'expired' | 'unknown-kid'

/**
 * What a refresh token resolves to: a live session, or why it cannot be used.
 * Callers supply their own error class, weight, and message for the failures.
 */
export type RefreshSessionResolution =
	| {
			readonly status: 'ok'
			readonly generation: number
			readonly nonce: string
			readonly session: SessionRow
	  }
	| {
			readonly status: 'invalid'
			readonly operation: JwtHandlerError['operation']
			readonly reason: RefreshSessionInvalidReason
	  }
	| {readonly status: 'missing'; readonly sessionId: string}

/**
 * Audit cause for an invalid refresh resolution. An expired token is a genuine
 * credential past its life; an unknown `kid` is treated as a rotation state
 * because a forged header is indistinguishable. Only `invalid` is a failed
 * credential presentation.
 */
export const invalidRefreshFailureCause = (reason: RefreshSessionInvalidReason) =>
	Match.value(reason).pipe(
		Match.when('expired', () => 'EXPIRED_JWS'),
		Match.when('unknown-kid', () => 'UNKNOWN_KID'),
		Match.orElse(() => 'INVALID_JWS'),
	)

/**
 * Read the refresh token and load the session it names.
 *
 * The access token says who the caller is, not which session. It is verified
 * without a database lookup, so it keeps working for up to 15 minutes after the
 * session was ended on another device (sign out all, password change). Without
 * this check such a device could still change the password or keep ending the
 * account’s new sessions, so any operation that must not act on a dead session
 * calls this first.
 *
 * Returns `invalid` when the token cannot be verified, `missing` when the row is
 * gone, expired, or revoked, and `ok` with the session otherwise. `reason` on an
 * invalid resolution separates a genuine token past its `exp` claim, a token
 * whose `kid` is no longer in the secret map (treated as a rotation state), and
 * one with a known `kid` that never verified, so callers can weight the
 * deployment and end-of-session states separately from a failed credential
 * presentation. It does not compare the nonce (pair it with
 * `verifyRefreshNonce` when possession of the current token matters) and it
 * changes nothing. Callers choose the error class, weight, and message for each
 * failure, since the same dead session is routine for a sign-out and suspicious
 * elsewhere.
 */
export const decodeRefreshSession = Effect.fn('decodeRefreshSession')(function* ({
	token,
}: {
	token: string
}) {
	const decoded = yield* extractRefreshTokenPayload(token).pipe(
		Effect.map((payload) => ({ok: true, payload}) as const),
		Effect.catchTag('JwtHandlerError', (error) =>
			isJwtKeyDerivationError(error)
				? Effect.fail(hkdfFailure(error))
				: Effect.succeed({
						ok: false,
						operation: error.operation,
						reason: isJwtExpiredError(error)
							? 'expired'
							: isUnknownKidError(error)
								? 'unknown-kid'
								: 'invalid',
					} as const),
		),
	)

	if (!decoded.ok)
		return {
			status: 'invalid',
			operation: decoded.operation,
			reason: decoded.reason,
		} as const

	const {generation, nonce, sessionId} = decoded.payload
	const [session] = yield* sessionsQueries.selectFromUnexpiredUnrevoked({id: sessionId})

	if (!session) return {status: 'missing', sessionId} as const

	return {status: 'ok', generation, nonce, session} as const
})

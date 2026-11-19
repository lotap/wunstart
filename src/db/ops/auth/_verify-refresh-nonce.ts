import {Effect} from 'effect'

import {verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'

import {extractRefreshGraceToken, noncesMatch} from './_refresh-grace-token.ts'

type SessionNonceRow = {
	userId: string
	refreshGeneration: number
	nonceHash: string
	graceToken: string | null
}

/**
 * Result of a presented refresh nonce check.
 * `grace-unreadable` is a rotated/removed secret set or a corrupt row, not abuse.
 */
export type RefreshNonceCheck = 'match' | 'mismatch' | 'grace-unreadable'

/**
 * Verify a presented refresh nonce against a live session row.
 *
 * The current generation is checked against the Argon2 hash. One generation
 * behind is checked against the previous nonce sealed in the grace token.
 * Unlike refresh's replay the grace window itself is not re-checked: this path
 * mints nothing, the session must still be live, and a slightly stale cookie
 * must still be able to end its session (rejecting it would accrue USER ban
 * weight and block refresh for the very user trying to sign out).
 */
export const verifyRefreshNonce = Effect.fn('verifyRefreshNonce')(function* ({
	session,
	generation,
	nonce,
}: {
	session: SessionNonceRow
	generation: number
	nonce: string
}) {
	if (generation === session.refreshGeneration) {
		const isMatch = yield* verifyTarget(session.nonceHash, nonce).pipe(
			// oxlint-disable-next-line effecttsgo/strict-effect-provide
			Effect.provide(HashingStub.layer(session.userId)),
		)

		return isMatch ? 'match' : 'mismatch'
	}

	if (generation === session.refreshGeneration - 1 && session.graceToken) {
		const graceTokenData = yield* extractRefreshGraceToken(session.graceToken).pipe(
			Effect.tapError((error) =>
				Effect.logWarning(
					'Grace token could not be decoded; treating its nonce as unverifiable',
					error.operation,
				),
			),
			Effect.catchTag('JwtHandlerError', () => Effect.succeed(null)),
		)

		if (!graceTokenData) return 'grace-unreadable'

		if (graceTokenData.generation !== session.refreshGeneration) return 'mismatch'

		return noncesMatch(graceTokenData.previousNonce, nonce) ? 'match' : 'mismatch'
	}

	return 'mismatch'
})

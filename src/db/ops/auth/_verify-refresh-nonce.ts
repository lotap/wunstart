import {Effect} from 'effect'

import {verifyTarget} from '#/db/ops/auth/_hashing.ts'
import {hkdfFailure, jwtFailureVerdict} from '#/db/ops/auth/_jwt-utils.ts'
import {HashingStub} from '#/db/ops/service-bindings.ts'

import {extractRefreshGraceToken, noncesMatch} from './_refresh-grace-token.ts'
import {GRACE_NONCE_CHECK_FAILURES} from './grace-token-policies.ts'

type SessionNonceRow = {
	userId: string
	refreshGeneration: number
	nonceHash: string
	graceToken: string | null
}

/**
 * Verify a presented refresh nonce against a live session row.
 *
 * The current generation is checked against the Argon2 hash. One generation
 * behind is checked against the previous nonce sealed in the grace token.
 * Unlike refresh's replay the grace window itself is not re-checked: this path
 * mints nothing, the session must still be live, and a previous-generation
 * cookie must still be able to end its session at any age. Rejecting it would
 * leave the live row unarchived until it expires.
 *
 * An HKDF failure while opening the grace token is infrastructure, not a token
 * verdict, so it fails the effect instead of returning a weight-0 check result.
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
			Effect.map((data) => ({ok: true, data}) as const),
			Effect.tapError((error) =>
				Effect.logWarning('Grace token could not be decoded', error.operation),
			),
			Effect.catchTag('JwtHandlerError', (error) => {
				const verdict = jwtFailureVerdict(error)

				if (verdict === 'hkdf') return Effect.fail(hkdfFailure(error))

				return Effect.succeed({
					ok: false,
					reason: GRACE_NONCE_CHECK_FAILURES[verdict],
				} as const)
			}),
		)

		if (!graceTokenData.ok) return graceTokenData.reason

		if (graceTokenData.data.generation !== session.refreshGeneration) return 'mismatch'

		return noncesMatch(graceTokenData.data.previousNonce, nonce) ? 'match' : 'mismatch'
	}

	return 'mismatch'
})

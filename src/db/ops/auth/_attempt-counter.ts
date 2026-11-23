import {Effect} from 'effect'

import {isClientIpAddress} from '#/db/helpers/ip-sentinels.ts'
import {AUTH_ATTEMPT_WINDOW} from '#/db/models/auth-attempts/consts.ts'
import * as authAttemptsQueries from '#/db/models/auth-attempts/queries.ts'
import type {AttemptScope} from '#/db/models/auth-attempts/validations.ts'

/**
 * Reserves one credential presentation against `target`.
 *
 * The count is taken before any hashing, so a crash after this call consumes the
 * attempt (fail-closed): an interrupted request cannot be replayed for free.
 * The calling op owns the denial — this helper only reports it, because the op
 * owns the generic message and the audit row.
 */
export const reserveAttempt = Effect.fn('reserveAttempt')(function* ({
	scope,
	target,
	allowance,
}: {
	scope: AttemptScope
	target: string
	allowance: number
}) {
	const [reservation] = yield* authAttemptsQueries.reserve({
		scope,
		target,
		window: AUTH_ATTEMPT_WINDOW,
		allowance,
	})

	return {allowed: reservation !== undefined}
})

/**
 * True when the credential counter is skipped for this presentation: the user
 * exists and the request comes from a network their Sessions signed in from.
 * Same escape as the credential-ban pre-check, so an attacker elsewhere cannot
 * exhaust the owner’s budget. The network counter never takes this escape.
 */
export const skipsCredentialAttempt = ({
	user,
	ipAddress,
}: {
	user: {hasKnownIp: boolean} | undefined
	ipAddress: string
}) => user !== undefined && isClientIpAddress(ipAddress) && user.hasKnownIp

import {Effect} from 'effect'

import {ipNetwork} from '#/db/helpers/ip-network.ts'
import {isClientIpAddress} from '#/db/helpers/ip-sentinels.ts'
import {AUTH_ATTEMPT_ALLOWANCE, AUTH_ATTEMPT_WINDOW} from '#/db/models/auth-attempts/consts.ts'
import * as authAttemptsQueries from '#/db/models/auth-attempts/queries.ts'
import type {AttemptScope} from '#/db/models/auth-attempts/validations.ts'
import {retryRollbackSafeDb} from '#/db/ops/_retry.ts'

/**
 * Upserts the auth attempt row for one scope/target while under its allowance.
 *
 * The row is upserted before any hashing, so a crash after this call leaves the
 * count recorded (fail-closed): an interrupted request cannot be replayed for free.
 * Returns whether the upsert was allowed; the op owns the denial and the
 * audit row.
 */
const upsertAuthAttemptAndGetAllowed = Effect.fn('upsertAuthAttemptAndGetAllowed')(function* ({
	scope,
	target,
	allowance,
}: {
	scope: AttemptScope
	target: string
	allowance: number
}) {
	const [countRow] = yield* authAttemptsQueries
		.upsert({
			scope,
			target,
			window: AUTH_ATTEMPT_WINDOW,
			allowance,
		})
		.pipe(retryRollbackSafeDb)

	return {allowed: countRow !== undefined}
})

/**
 * True when this presentation escapes the credential ban and allowance: the user
 * exists and the request comes from a network their Sessions signed in from.
 *
 * The ban pre-check and `enforceAuthAttemptAllowance` both use it, so they cannot
 * disagree about which presentations are exempt. It keeps a known network usable while an
 * attacker elsewhere fills the credential allowance; a presentation from a new
 * network still shares that allowance and can be denied until the window rolls.
 * The network allowance never takes this escape.
 *
 * The network is the same key the ban uses, so an IPv6 `/64` counts as one known
 * network: every host in it shares the exemption and the ban.
 */
export const skipsCredentialAttempt = ({
	user,
	ipAddress,
}: {
	user: {hasKnownIp: boolean} | undefined
	ipAddress: string
}) => user !== undefined && isClientIpAddress(ipAddress) && user.hasKnownIp

/**
 * Enforces the auth attempt allowance for an unauthenticated credential
 * presentation, against the client network and, unless the
 * known-network escape applies, the claimed email.
 *
 * The network denial short-circuits: the request never hashes, so it must not
 * upsert the email's row. The network row is charged first, so a credential
 * denial has already spent a network slot; reversing the order would let a
 * blocked network drain a claimed email's allowance. Returns `allowed: false`
 * when either target is at its allowance; the calling op owns the denial and
 * the audit row.
 */
export const enforceAuthAttemptAllowance = Effect.fn('enforceAuthAttemptAllowance')(function* ({
	ipAddress,
	email,
	user,
}: {
	ipAddress: string
	email: string
	user: {hasKnownIp: boolean} | undefined
}) {
	const networkAttempt = yield* upsertAuthAttemptAndGetAllowed({
		scope: 'NETWORK',
		target: ipNetwork(ipAddress),
		allowance: AUTH_ATTEMPT_ALLOWANCE.network,
	})

	if (!networkAttempt.allowed) return {allowed: false}

	const credentialAttempt = skipsCredentialAttempt({user, ipAddress})
		? undefined
		: yield* upsertAuthAttemptAndGetAllowed({
				scope: 'CREDENTIAL',
				target: email,
				allowance: AUTH_ATTEMPT_ALLOWANCE.credential,
			})

	if (credentialAttempt?.allowed === false) return {allowed: false}

	return {allowed: true}
})

import {Effect} from 'effect'

import * as sessionsQueries from '#/db/models/sessions/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {formatUserAgent} from '#/db/ops/auth/_user-agent.ts'
import {hkdfFailure, jwtFailureVerdict} from '#/db/ops/auth/tokens/_jwt-utils.ts'
import {extractRefreshTokenPayload} from '#/db/ops/auth/tokens/_refresh-token.ts'
import {formatLocation} from '#/email/format-location.ts'

const _listSessions = Effect.fn('listSessions')(function* ({
	userId,
	refreshToken,
}: {
	userId: string
	refreshToken: string
}) {
	const currentSessionId = yield* extractRefreshTokenPayload(refreshToken).pipe(
		Effect.map((payload) => payload.sessionId),
		/**
		 * An invalid, expired, or rotated-out refresh JWS only means this device’s
		 * session cannot be identified; the caller clears the pair. An HKDF failure
		 * is an infrastructure outage and must not look like an invalid token, so
		 * it stays a failure and the cookies are kept.
		 */
		Effect.catchTag('JwtHandlerError', (error) =>
			jwtFailureVerdict(error) === 'hkdf' ? Effect.fail(hkdfFailure(error)) : Effect.succeed(null),
		),
	)

	/**
	 * The list is user-scoped, so a valid refresh token for another User is
	 * simply absent: no row gets `isCurrent`, and the caller clears the pair.
	 */
	const sessions = yield* sessionsQueries.selectFromUnexpiredUnrevokedByUser({userId})

	return sessions.map((session) => ({
		createdAt: session.createdAt,
		ipAddress: session.ipAddresses.at(-1) ?? null,
		device: formatUserAgent(session.userAgents.at(-1) ?? 'unknown'),
		location: formatLocation({
			city: session.cities.at(-1) ?? null,
			region: session.regions.at(-1) ?? null,
			country: session.countries.at(-1) ?? 'XX',
		}),
		isCurrent: currentSessionId !== null && session.id === currentSessionId,
	}))
})

export const listSessions = createOpsFn({
	fn: _listSessions,
	label: 'AUTH_SESSIONS_LIST_SESSIONS',
})

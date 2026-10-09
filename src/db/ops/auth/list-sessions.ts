import {Effect} from 'effect'

import * as sessionsQueries from '#/db/models/sessions/queries.ts'
import {createOpsFn} from '#/db/ops/_create-ops-fn.ts'
import {formatLocation} from '#/email/format-location.ts'

import {extractRefreshTokenPayload} from './_refresh-token.ts'
import {formatUserAgent} from './_user-agent.ts'

const _listSessions = Effect.fn('listSessions')(function* ({
	userId,
	refreshToken,
}: {
	userId: string
	refreshToken: string
}) {
	const currentSessionId = yield* extractRefreshTokenPayload(refreshToken).pipe(
		Effect.map((payload) => payload.sessionId),
		Effect.catch(() => Effect.succeed(null)),
	)

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
	label: 'AUTH_LIST_SESSIONS',
})

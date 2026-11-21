import {eq, sql} from 'drizzle-orm'
import {Struct} from 'effect'

import {createPreparedQuery} from '#/db/helpers/query-fns.ts'
import type {QueryExecutor} from '#/db/helpers/types.ts'
import {IpAddress} from '#/db/helpers/validators.ts'
import {activeTable as sessions} from '#/db/models/sessions/schemas.ts'
import {activeTable as users} from '#/db/models/users/schemas.ts'
import {ByEmail} from '#/db/models/users/validations.ts'

const ByEmailAndIp = ByEmail.mapFields(Struct.assign({ipAddress: IpAddress}))

const selectUserByEmailCTE = (qx: QueryExecutor) =>
	qx.$with('select_user_by_email_cte').as(
		qx
			.select({
				id: users.id.as('id'),
				email: users.email.as('email'),
				passwordHash: users.passwordHash.as('passwordHash'),
			})
			.from(users)
			.where(sql`lower(${users.email}) = lower(${sql.placeholder('email')})`)
			.limit(1),
	)

const selectSessionsIpAddressesCTE = (qx: QueryExecutor) =>
	qx.$with('select_sessions_ip_addresses_cte').as(
		qx
			.select({
				userId: sessions.userId.as('userId'),
				ipAddress: sql<string>`unnest(${sessions.ipAddresses})`.as('ip_address'),
			})
			.from(sessions),
	)

/**
 * User lookup for credential ops, including whether the request IP appears in
 * any of the user's Sessions. The comparison runs as `inet = inet` so Postgres
 * canonicalizes both sides; comparing raw strings would false-deny an owner
 * whose IPv6 spelling differs from `host()` output.
 */
export const selectUserWithKnownIpByEmail = createPreparedQuery({
	vSchema: ByEmailAndIp,
	stmtFn: (qx) => {
		const selectUserByEmail = selectUserByEmailCTE(qx)
		const selectSessionsIpAddresses = selectSessionsIpAddressesCTE(qx)

		const hasKnownIp =
			sql<boolean>`coalesce(bool_or(${selectSessionsIpAddresses.ipAddress} = ${sql.placeholder('ipAddress')}::inet), false)`.as(
				'has_known_ip',
			)

		return qx
			.with(selectUserByEmail, selectSessionsIpAddresses)
			.select({
				id: selectUserByEmail.id,
				email: selectUserByEmail.email,
				passwordHash: selectUserByEmail.passwordHash,
				hasKnownIp,
			})
			.from(selectUserByEmail)
			.leftJoin(
				selectSessionsIpAddresses,
				eq(selectUserByEmail.id, selectSessionsIpAddresses.userId),
			)
			.groupBy(selectUserByEmail.id, selectUserByEmail.email, selectUserByEmail.passwordHash)
			.prepare('sessions_users_select_user_with_known_ip_by_email')
	},
})

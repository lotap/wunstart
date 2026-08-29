import {eq, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'
import type {QueryExecutor} from '#/db/helpers/types.ts'
import {activeTable as sessions} from '#/db/models/sessions/schemas.ts'
import {activeTable as users} from '#/db/models/users/schemas.ts'
import {ByEmail} from '#/db/models/users/validations.ts'

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

export const selectUserWithIpAddressesByEmail = createPreparedQuery({
	vSchema: ByEmail,
	stmtFn: (qx) => {
		const selectUserByEmail = selectUserByEmailCTE(qx)
		const selectSessionsIpAddresses = selectSessionsIpAddressesCTE(qx)

		return qx
			.with(selectUserByEmail, selectSessionsIpAddresses)
			.select({
				id: selectUserByEmail.id,
				email: selectUserByEmail.email,
				passwordHash: selectUserByEmail.passwordHash,
				ipAddresses: sql<
					string[]
				>`array_agg(DISTINCT host(${selectSessionsIpAddresses.ipAddress}))`.as('ip_addresses'),
			})
			.from(selectUserByEmail)
			.leftJoin(
				selectSessionsIpAddresses,
				eq(selectUserByEmail.id, selectSessionsIpAddresses.userId),
			)
			.groupBy(selectUserByEmail.id, selectUserByEmail.email, selectUserByEmail.passwordHash)
			.prepare('sessions_users_select_user_with_ip_addresses_by_email')
	},
})

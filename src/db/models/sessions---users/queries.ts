import {eq, sql, type SQLWrapper} from 'drizzle-orm'
import {Struct} from 'effect'

import {IP_NETWORK_PREFIX} from '#/db/helpers/ip-network.ts'
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
 * Masks an address to its family's network prefix (`IP_NETWORK_PREFIX`). Both
 * sides of the known-IP check run through it, so an owner whose IPv6 interface
 * identifier rotated still matches, and the prefix lengths stay in TypeScript.
 *
 * Assumes canonical addresses. A mapped spelling (`::ffff:a.b.c.d`) takes the
 * IPv6 branch and masks to `::/64`, sharing a key with every other mapped
 * client. `getRequestInfo` canonicalises at the boundary; a writer that bypasses
 * it must canonicalise (`canonicalIp`) before this comparison.
 */
const toNetwork = (address: SQLWrapper) =>
	sql`network(set_masklen(${address}::inet, CASE WHEN family(${address}::inet) = 6 THEN ${IP_NETWORK_PREFIX.v6} ELSE ${IP_NETWORK_PREFIX.v4} END))`

/**
 * User lookup for credential ops, including whether the request comes from one
 * of the networks the user's Sessions signed in from. Both sides are masked
 * before comparing, so the check never compares a network to an address, and
 * an IPv4 session stays on the IPv4 branch.
 */
export const selectUserWithKnownIpByEmail = createPreparedQuery({
	vSchema: ByEmailAndIp,
	stmtFn: (qx) => {
		const selectUserByEmail = selectUserByEmailCTE(qx)
		const selectSessionsIpAddresses = selectSessionsIpAddressesCTE(qx)

		const hasKnownIp =
			sql<boolean>`coalesce(bool_or(${toNetwork(selectSessionsIpAddresses.ipAddress)} = ${toNetwork(sql.placeholder('ipAddress'))}), false)`.as(
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

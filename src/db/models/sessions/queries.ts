import {and, desc, eq, getColumns, isNull, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'

import {activeTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {
	id,
	userId,
	createdAt,
	ipAddresses,
	userAgents,
	countries,
	cities,
	regions,
	expiresAt,
	nonceHash,
	refreshGeneration,
	revokedAt,
} = getColumns(activeTable)

/// INSERT ///

export const insert = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				userId: sql.placeholder('userId'),
				ipAddresses: sql`ARRAY[${sql.placeholder('ipAddress')}::inet]`,
				userAgents: sql`ARRAY[${sql.placeholder('userAgent')}::text]`,
				countries: sql`ARRAY[${sql.placeholder('country')}::text]`,
				cities: sql.placeholder('cities'),
				regions: sql.placeholder('regions'),
				nonceHash: sql.placeholder('nonceHash'),
			})
			.returning({id, expiresAt, refreshGeneration})
			.prepare(`${labelPrefix}_insert`),
})

/// SELECT ///

export const select = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(eq(id, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_select`),
})

export const selectByUser = createPreparedQuery({
	vSchema: V.ByUser,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(eq(userId, sql.placeholder('userId')))
			.prepare(`${labelPrefix}_select_by_user`),
})

export const selectFromUnexpiredUnrevoked = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(and(eq(id, sql.placeholder('id')), sql`${expiresAt} > now()`, isNull(revokedAt)))
			.limit(1)
			.prepare(`${labelPrefix}_select_from_unexpired_unrevoked`),
})

export const selectFromUnexpiredUnrevokedByUser = createPreparedQuery({
	vSchema: V.ByUser,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(
				and(eq(userId, sql.placeholder('userId')), sql`${expiresAt} > now()`, isNull(revokedAt)),
			)
			.orderBy(desc(createdAt))
			.prepare(`${labelPrefix}_select_from_unexpired_unrevoked_by_user`),
})

/// UPDATE ///

/** Compare-and-swap rotation: only succeeds if the session is still on the expected generation/hash and not revoked or expired */
export const rotate = createPreparedQuery({
	vSchema: V.Rotate,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({
				ipAddresses: sql`ARRAY(SELECT DISTINCT unnest(array_cat(${
					ipAddresses
				}, ARRAY[${sql.placeholder('ipAddress')}::inet])))`,
				userAgents: sql`ARRAY(SELECT DISTINCT unnest(array_cat(${
					userAgents
				}, ARRAY[${sql.placeholder('userAgent')}::text])))`,
				countries: sql`ARRAY(SELECT DISTINCT unnest(array_cat(${
					countries
				}, ARRAY[${sql.placeholder('country')}::text])))`,
				cities: sql`ARRAY(SELECT DISTINCT unnest(array_cat(${
					cities
				}, ${sql.placeholder('newCities')}::text[])))`,
				regions: sql`ARRAY(SELECT DISTINCT unnest(array_cat(${
					regions
				}, ${sql.placeholder('newRegions')}::text[])))`,
				nonceHash: sql`${sql.placeholder('nextNonceHash')}`,
				refreshGeneration: sql`${sql.placeholder('refreshGeneration')} + 1`,
				expiresAt: sql`${sql.placeholder('expiresAt')}`,
				graceExpiresAt: sql`${sql.placeholder('graceExpiresAt')}`,
				graceToken: sql`${sql.placeholder('graceToken')}`,
			})
			.where(
				and(
					eq(id, sql.placeholder('id')),
					eq(nonceHash, sql.placeholder('currentNonceHash')),
					eq(refreshGeneration, sql.placeholder('refreshGeneration')),
					isNull(revokedAt),
					sql`${expiresAt} > now()`,
				),
			)
			.returning({userId, expiresAt, refreshGeneration})
			.prepare(`${labelPrefix}_rotate`),
})

/** Revokes a session family. Clears grace state so no successor secret survives on a dead row */
export const revoke = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({
				revokedAt: sql`now()`,
				graceExpiresAt: null,
				graceToken: null,
			})
			.where(and(eq(id, sql.placeholder('id')), isNull(revokedAt)))
			.returning({id})
			.prepare(`${labelPrefix}_revoke`),
})

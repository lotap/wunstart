import {and, eq, getColumns, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'

import {activeTable, archiveTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {passwordHash, ...nonsensitiveCols} = getColumns(activeTable)

const {id, email, updatedAt} = nonsensitiveCols

/// INSERT ///

export const insert = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				email: sql.placeholder('email'),
				passwordHash: sql.placeholder('passwordHash'),
			})
			.returning({id, email})
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

export const selectByEmail = createPreparedQuery({
	vSchema: V.ByEmail,
	stmtFn: (qx) =>
		qx
			.select()
			.from(activeTable)
			.where(sql`lower(${email}) = lower(${sql.placeholder('email')})`)
			.limit(1)
			.prepare(`${labelPrefix}_select_by_email`),
})

const {id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...profileCols} = nonsensitiveCols
export const selectProfile = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select({
				...profileCols,
				hasPassword: sql<boolean>`${passwordHash} IS NOT NULL`,
			})
			.from(activeTable)
			.where(eq(id, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_select_profile`),
})

/// UPDATE ///

export const updatePasswordHash = createPreparedQuery({
	vSchema: V.UpdatePasswordHash,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({passwordHash: sql.placeholder('passwordHash')})
			.where(eq(id, sql.placeholder('id')))
			.returning({email, updatedAt})
			.prepare(`${labelPrefix}_update_password_hash`),
})

export const updatePasswordHashIfMatches = createPreparedQuery({
	vSchema: V.UpdatePasswordHashIfMatches,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({passwordHash: sql.placeholder('newHash')})
			.where(and(eq(id, sql.placeholder('id')), eq(passwordHash, sql.placeholder('passwordHash'))))
			.returning({email, updatedAt})
			.prepare(`${labelPrefix}_update_password_hash_if_matches`),
})

export const updateEmail = createPreparedQuery({
	vSchema: V.UpdateEmail,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({email: sql.placeholder('email')})
			.where(eq(id, sql.placeholder('id')))
			.returning({email, updatedAt})
			.prepare(`${labelPrefix}_update_email`),
})

/// ARCHIVE ///

/// PRIMITIVES ///

const {id: activeId, archiveId} = getColumns(archiveTable)

/// SELECT ///

export const archiveSelectByActiveId = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select({archiveId})
			.from(archiveTable)
			.where(eq(activeId, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_archive_select_by_active_id`),
})

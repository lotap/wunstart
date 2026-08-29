import {and, eq, getColumns, isNotNull, or, sql} from 'drizzle-orm'

import {createPreparedQuery} from '#/db/helpers/funcs.ts'

import {activeTable, archiveTable, tableName} from './schemas.ts'
import * as V from './validations.ts'

/// PRIMITIVES ///

const labelPrefix = tableName

const {passcodeHash, ...nonsensitiveCols} = getColumns(activeTable)

const {id, anonId, userId, attempts, email, expiresAt} = nonsensitiveCols

/// INSERT ///

export const insert = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.insert(activeTable)
			.values({
				anonId: sql.placeholder('anonId'),
				userId: sql.placeholder('userId'),
				email: sql.placeholder('email'),
				passcodeHash: sql.placeholder('passcodeHash'),
			})
			.returning({id, expiresAt})
			.prepare(`${labelPrefix}_insert`),
})

/// SELECT ///

export const select = createPreparedQuery({
	vSchema: V.Select,
	stmtFn: (qx) =>
		qx
			.select(nonsensitiveCols)
			.from(activeTable)
			.where(eq(id, sql.placeholder('id')))
			.limit(1)
			.prepare(`${labelPrefix}_select`),
})

export const selectByAnon = createPreparedQuery({
	vSchema: V.ByAnon,
	stmtFn: (qx) =>
		qx
			.select(nonsensitiveCols)
			.from(activeTable)
			.where(eq(anonId, sql.placeholder('anonId')))
			.prepare(`${labelPrefix}_select_by_anon`),
})

export const selectByUser = createPreparedQuery({
	vSchema: V.ByUser,
	stmtFn: (qx) =>
		qx
			.select(nonsensitiveCols)
			.from(activeTable)
			.where(eq(userId, sql.placeholder('userId')))
			.prepare(`${labelPrefix}_select_by_user`),
})

export const selectFromUnexpiredByEmailAndEntityId = createPreparedQuery({
	vSchema: V.ByEmailAndEntityId,
	stmtFn: (qx) =>
		qx
			.select() // INCLUDES PASSCODE_HASH
			.from(activeTable)
			.where(
				and(
					or(
						and(isNotNull(anonId), eq(anonId, sql.placeholder('anonId'))),
						and(isNotNull(userId), eq(userId, sql.placeholder('userId'))),
					),
					sql`lower(${email}) = lower(${sql.placeholder('email')})`,
					sql`${expiresAt} > now()`,
				),
			)
			.limit(1)
			.prepare(`${labelPrefix}_select_from_unexpired_by_email_and_entity_id`),
})

export const selectWithPasscode = createPreparedQuery({
	vSchema: V.WithPasscode,
	stmtFn: (qx) =>
		qx
			.select(nonsensitiveCols)
			.from(activeTable)
			.where(and(eq(id, sql.placeholder('id')), eq(passcodeHash, sql.placeholder('passcodeHash'))))
			.limit(1)
			.prepare(`${labelPrefix}_select_with_passcode`),
})

/// UPDATE ///

export const incrementAttempts = createPreparedQuery({
	vSchema: V.Update,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({attempts: sql`${activeTable.attempts} + 1`})
			.where(
				and(
					eq(id, sql.placeholder('id')),
					or(
						and(isNotNull(anonId), eq(anonId, sql.placeholder('anonId'))),
						and(isNotNull(userId), eq(userId, sql.placeholder('userId'))),
					),
					eq(passcodeHash, sql.placeholder('passcodeHash')),
					sql`${expiresAt} > now()`,
					sql`${attempts} < ${sql.placeholder('maxAttempts')}`,
				),
			)
			.returning({attempts})
			.prepare(`${labelPrefix}_increment_attempts`),
})

export const resetFromExpiringByEmail = createPreparedQuery({
	vSchema: V.Insert,
	stmtFn: (qx) =>
		qx
			.update(activeTable)
			.set({
				attempts: 0,
				expiresAt: sql`now() + '15 minutes'::interval`,
				passcodeHash: sql.placeholder('passcodeHash'),
			})
			.where(
				and(
					eq(email, sql.placeholder('email')),
					or(
						and(isNotNull(anonId), eq(anonId, sql.placeholder('anonId'))),
						and(isNotNull(userId), eq(userId, sql.placeholder('userId'))),
					),
					sql`${expiresAt} < now() + '14 minutes'::interval`,
				),
			)
			.returning({id, expiresAt})
			.prepare(`${labelPrefix}_reset_from_expiring_by_email`),
})

/// DELETE ///

export const deleteFromUnexpiredWithPasscodeAndEntityId = createPreparedQuery({
	vSchema: V.WithPasscodeAndEntityId,
	stmtFn: (qx) =>
		qx
			.delete(activeTable)
			.where(
				and(
					eq(id, sql.placeholder('id')),
					or(
						and(isNotNull(anonId), eq(anonId, sql.placeholder('anonId'))),
						and(isNotNull(userId), eq(userId, sql.placeholder('userId'))),
					),
					eq(passcodeHash, sql.placeholder('passcodeHash')),
					sql`${expiresAt} > now()`,
				),
			)
			.returning()
			.prepare(`${labelPrefix}_delete_from_unexpired_with_passcode_and_entity_id`),
})

/// ARCHIVE ///

/// PRIMITIVES ///

const {id: activeId, archivedAt} = getColumns(archiveTable)

/// UPDATE ///

export const archiveAddVerified = createPreparedQuery({
	vSchema: V.ArchiveAddVerified,
	stmtFn: (qx) =>
		qx
			.update(archiveTable)
			.set({verifiedAt: sql`${archivedAt}`, userId: sql.placeholder('userId')})
			.where(eq(activeId, sql.placeholder('id')))
			.prepare(`${labelPrefix}_archive_add_verified`),
})

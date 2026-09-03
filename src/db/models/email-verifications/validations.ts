import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Schema, Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {Argon2Hash, NullishToNull, UUID} from '#/db/helpers/validators.ts'
import {Email} from '#/isomorphic/validators.ts'

import {activeTable, archiveTable} from './schemas.ts'

/// PRIMITIVES

const overrides = {
	email: Email,
	passcodeHash: Argon2Hash,
} satisfies RefinementsFor<typeof activeTable>

const insertPrimitive = createInsertSchema(activeTable, overrides)

const selectPrimitive = createSelectSchema(activeTable, overrides)

/// INSERT ///

const insertBase = insertPrimitive.mapFields(
	Struct.pick(['email', 'passcodeHash', 'anonId', 'userId']),
)

export const Insert = Schema.Union([
	insertBase.mapFields(
		Struct.evolve({
			anonId: () => UUID,
			userId: () => NullishToNull,
		}),
	),
	insertBase.mapFields(
		Struct.evolve({
			anonId: () => NullishToNull,
			userId: () => UUID,
		}),
	),
])

/// SELECT ///

export const Select = selectPrimitive.mapFields(Struct.pick(['id']))

export const ByAnon = selectPrimitive
	.mapFields(Struct.pick(['anonId']))
	.mapFields(Struct.evolve({anonId: () => UUID}))

export const ByUser = selectPrimitive
	.mapFields(Struct.pick(['userId']))
	.mapFields(Struct.evolve({userId: () => UUID}))

export const WithPasscode = selectPrimitive.mapFields(Struct.pick(['id', 'passcodeHash']))

const byEmailAndEntityIdBase = selectPrimitive.mapFields(Struct.pick(['anonId', 'email', 'userId']))

export const ByEmailAndEntityId = Schema.Union([
	byEmailAndEntityIdBase.mapFields(
		Struct.evolve({
			anonId: () => UUID,
			userId: () => NullishToNull,
		}),
	),
	byEmailAndEntityIdBase.mapFields(
		Struct.evolve({
			anonId: () => NullishToNull,
			userId: () => UUID,
		}),
	),
])

/// UPDATE ///

const updateBase = selectPrimitive
	.mapFields(Struct.pick(['id', 'anonId', 'userId', 'passcodeHash']))
	.mapFields(Struct.assign({maxAttempts: Schema.Int}))

export const Update = Schema.Union([
	updateBase.mapFields(
		Struct.evolve({
			anonId: () => UUID,
			userId: () => NullishToNull,
		}),
	),
	updateBase.mapFields(
		Struct.evolve({
			anonId: () => NullishToNull,
			userId: () => UUID,
		}),
	),
])

/// DELETE ///

const withPasscodeAndEntityIdBase = selectPrimitive.mapFields(
	Struct.pick(['id', 'anonId', 'userId', 'passcodeHash']),
)

export const WithPasscodeAndEntityId = Schema.Union([
	withPasscodeAndEntityIdBase.mapFields(
		Struct.evolve({
			anonId: () => UUID,
			userId: () => NullishToNull,
		}),
	),
	withPasscodeAndEntityIdBase.mapFields(
		Struct.evolve({
			anonId: () => NullishToNull,
			userId: () => UUID,
		}),
	),
	withPasscodeAndEntityIdBase.mapFields(
		Struct.evolve({
			anonId: () => UUID,
			userId: () => UUID,
		}),
	),
])

/// ARCHIVE ///

/// PRIMITIVES ///

const archiveOverrides = {
	email: Email,
} satisfies RefinementsFor<typeof archiveTable>

const archiveSelectPrimitive = createSelectSchema(archiveTable, archiveOverrides)

/// UPDATE ///

export const ArchiveAddVerified = archiveSelectPrimitive.mapFields(Struct.pick(['id', 'userId']))

import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Schema, Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {Argon2Hash} from '#/db/helpers/validators.ts'
import {Email} from '#/isomorphic/validators.ts'

import {activeTable} from './schemas.ts'

/// PRIMITIVES ///

const overrides = {
	email: Email,
	passwordHash: Schema.optional(Schema.NullOr(Argon2Hash)),
} satisfies RefinementsFor<typeof activeTable>

const insertPrimitive = createInsertSchema(activeTable, overrides)

const selectPrimitive = createSelectSchema(activeTable, overrides)

/// INSERT ///

export const Insert = insertPrimitive.mapFields(Struct.pick(['email', 'passwordHash']))

/// SELECT ///

export const Select = selectPrimitive.mapFields(Struct.pick(['id']))

export const ByEmail = selectPrimitive.mapFields(Struct.pick(['email']))

/// UPDATE ///

export const UpdatePasswordHash = selectPrimitive
	.mapFields(Struct.pick(['id', 'passwordHash']))
	.mapFields(Struct.evolve({passwordHash: () => Argon2Hash}))

export const UpdatePasswordHashIfMatches = UpdatePasswordHash.mapFields(
	Struct.assign({newHash: Argon2Hash}),
)

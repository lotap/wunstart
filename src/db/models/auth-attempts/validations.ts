import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Schema, Struct} from 'effect'

import {PGVerboseInterval, PositiveInt} from '#/db/helpers/validators.ts'

import {activeTable, attemptScopes} from './schemas.ts'

/// PRIMITIVES ///

const insertPrimitive = createInsertSchema(activeTable)

const attemptScopesSelectPrimitive = createSelectSchema(attemptScopes)

/** The counted presentation kinds, as the enum's own value union */
export type AttemptScope = (typeof attemptScopesSelectPrimitive)['Type']

/// INSERT ///

export const Upsert = insertPrimitive.mapFields(Struct.pick(['scope', 'target'])).mapFields(
	Struct.assign({
		window: PGVerboseInterval,
		allowance: PositiveInt,
	}),
)

/// DELETE ///

export const ByCutoff = Schema.Struct({
	cutoff: PGVerboseInterval,
	limit: PositiveInt,
})

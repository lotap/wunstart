import {createInsertSchema, createSelectSchema} from 'drizzle-orm/effect-schema'
import {Effect, Schema, Struct} from 'effect'

import type {RefinementsFor} from '#/db/helpers/types.ts'
import {
	IpAddress,
	NullishToNull,
	PGVerboseInterval,
	PositiveInt,
	withNullDefault,
} from '#/db/helpers/validators.ts'
import {ACTIVITIES_BASELINE_WEIGHT} from '#/db/models/activities/consts.ts'

import {activeTable} from './schemas.ts'

/// PRIMITIVES ///

const overrides = {
	ipAddress: IpAddress,
} satisfies RefinementsFor<typeof activeTable>

const insertPrimitive = createInsertSchema(activeTable, overrides)

const selectPrimitive = createSelectSchema(activeTable, overrides)

/// INSERT ///

const InsertBaseVariant = insertPrimitive.mapFields(Struct.omit(['id', 'timestamp'])).mapFields(
	Struct.evolve({
		anonId: (field) => field.pipe(withNullDefault),
		anonsArchiveId: (field) => field.pipe(withNullDefault),
		meta: (field) => field.pipe(withNullDefault),
		userId: (field) => field.pipe(withNullDefault),
		usersArchiveId: (field) => field.pipe(withNullDefault),
		weight: (field) =>
			field.pipe(Schema.withDecodingDefault(Effect.succeed(ACTIVITIES_BASELINE_WEIGHT))),
	}),
)

const InsertSuccessVariant = InsertBaseVariant.mapFields(
	Struct.evolve({
		success: () => Schema.Literal(true),
		failureCause: () => NullishToNull,
		failedCredential: () => NullishToNull,
	}),
)

/**
 * You could use another tier of union schemas keying on the failureCause here.
 * That's how it was originally written,
 * but its easier to maintain failureCause as string instead of an enum
 **/
export const InsertFailureVariant = InsertBaseVariant.mapFields(
	Struct.evolve({
		success: () => Schema.Literal(false),
		failureCause: () => Schema.String,
		failedCredential: (field) => field.pipe(withNullDefault),
	}),
)

export const Insert = Schema.Union([InsertSuccessVariant, InsertFailureVariant])

/// SELECT ///

export const Select = selectPrimitive.mapFields(Struct.pick(['id']))

export const ByCutoff = Schema.Struct({
	cutoff: PGVerboseInterval,
	limit: PositiveInt,
})
